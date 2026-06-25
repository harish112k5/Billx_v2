/**
 * dataFrequency.js
 * 
 * API endpoints for data frequency tracking.
 * Returns event history and module summaries so the frontend
 * can show "last updated" timestamps on every chart.
 * 
 * IMPORTANT: Also queries real tables (ra_bills, boq_items, expenses)
 * for fallback timestamps when data_events is empty (pre-tracking data).
 */

const express = require('express');
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

/**
 * Compute a human-readable "time ago" string from a date.
 */
function timeAgo(dateStr) {
  if (!dateStr) return 'Never';
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;

  // Older than 7 days — return formatted date
  return then.toLocaleDateString('en-IN', {
    month: 'short', day: 'numeric', year: 'numeric',
    timeZone: 'Asia/Kolkata'
  });
}

/**
 * Get fallback timestamps from actual data tables when data_events is empty.
 * This covers data that existed before tracking was enabled.
 */
async function getFallbackTimestamps(projectId) {
  const fallback = {};

  try {
    // RA Bills — latest created_at
    const [raBills] = await db.execute(
      `SELECT MAX(created_at) AS last_updated, COUNT(*) AS count 
       FROM ra_bills WHERE project_id = ?`, [projectId]
    );
    if (raBills[0]?.last_updated) {
      fallback.ra_bill = {
        count: raBills[0].count,
        last_updated: raBills[0].last_updated,
        last_event: 'excel_import',
        time_ago: timeAgo(raBills[0].last_updated),
      };
    }

    // BOQ Items — latest updated_at or created_at
    const [boq] = await db.execute(
      `SELECT MAX(COALESCE(updated_at, created_at)) AS last_updated, COUNT(*) AS count 
       FROM boq_items WHERE project_id = ?`, [projectId]
    );
    if (boq[0]?.last_updated) {
      fallback.boq = {
        count: boq[0].count,
        last_updated: boq[0].last_updated,
        last_event: 'excel_import',
        time_ago: timeAgo(boq[0].last_updated),
      };
    }

    // Expenses — latest created_at
    const [expenses] = await db.execute(
      `SELECT MAX(created_at) AS last_updated, COUNT(*) AS count 
       FROM project_expenses WHERE project_id = ?`, [projectId]
    );
    if (expenses[0]?.last_updated) {
      fallback.expenses = {
        count: expenses[0].count,
        last_updated: expenses[0].last_updated,
        last_event: 'manual_expense',
        time_ago: timeAgo(expenses[0].last_updated),
      };
    }

    // Measurements — latest created_at via boq_items
    const [measurements] = await db.execute(
      `SELECT MAX(m.created_at) AS last_updated, COUNT(*) AS count 
       FROM measurements m 
       JOIN boq_items b ON m.boq_id = b.boq_id
       WHERE b.project_id = ?`, [projectId]
    );
    if (measurements[0]?.last_updated) {
      fallback.measurements = {
        count: measurements[0].count,
        last_updated: measurements[0].last_updated,
        last_event: 'excel_import',
        time_ago: timeAgo(measurements[0].last_updated),
      };
    }
  } catch (err) {
    // Some tables might not exist or have different columns — safe to ignore
    console.log('[DataFrequency] Fallback query warning:', err.message);
  }

  return fallback;
}

/**
 * Build "recent activity" from actual table data when no tracked events exist.
 * Scans ra_bills, boq_items, expenses, measurements for recent records.
 */
async function getRecentActivity(projectId) {
  const activity = [];

  try {
    // Recent RA Bills
    const [raBills] = await db.execute(
      `SELECT r.ra_bill_id, r.ra_number, r.net_payable, r.stage, r.created_at, 
              r.bill_period_from, r.bill_period_to,
              u.name AS created_by_name
       FROM ra_bills r
       LEFT JOIN users u ON r.created_by = u.user_id
       WHERE r.project_id = ?
       ORDER BY r.created_at DESC LIMIT 10`, [projectId]
    );
    raBills.forEach(r => {
      activity.push({
        event_id: `ra-${r.ra_bill_id}`,
        event_type: 'excel_import',
        affected_module: 'ra_bill',
        description: `RA Bill RA-${String(r.ra_number).padStart(2, '0')} — Net ₹${parseFloat(r.net_payable || 0).toLocaleString('en-IN')} (${r.stage})`,
        performed_at: r.created_at,
        performed_by_name: r.created_by_name || 'System',
        time_ago: timeAgo(r.created_at),
        ra_bill_number: r.ra_number,
        amount_after: parseFloat(r.net_payable) || 0,
        source: 'ra_bills',
      });
    });

    // Recent Expenses
    const [expenses] = await db.execute(
      `SELECT e.expense_id, e.description, e.category, e.expense_type, e.amount, e.expense_date, e.created_at,
              u.name AS created_by_name
       FROM project_expenses e
       LEFT JOIN users u ON e.created_by = u.user_id
       WHERE e.project_id = ?
       ORDER BY e.created_at DESC LIMIT 10`, [projectId]
    );
    expenses.forEach(e => {
      activity.push({
        event_id: `exp-${e.expense_id}`,
        event_type: 'manual_expense',
        affected_module: 'expenses',
        description: `${e.category || e.expense_type || 'Expense'}: ₹${parseFloat(e.amount || 0).toLocaleString('en-IN')} — ${e.description || 'No description'}`,
        performed_at: e.created_at,
        performed_by_name: e.created_by_name || 'System',
        time_ago: timeAgo(e.created_at),
        amount_after: parseFloat(e.amount) || 0,
        source: 'project_expenses',
      });
    });

    // Recent BOQ items (just the latest ones — bulk imports can create many)
    const [boqItems] = await db.execute(
      `SELECT b.boq_id, b.item_code, b.description, b.planned_quantity, b.unit, b.unit_rate,
              COALESCE(b.updated_at, b.created_at) AS last_change
       FROM boq_items b
       WHERE b.project_id = ?
       ORDER BY COALESCE(b.updated_at, b.created_at) DESC LIMIT 5`, [projectId]
    );
    boqItems.forEach(b => {
      activity.push({
        event_id: `boq-${b.boq_id}`,
        event_type: 'excel_import',
        affected_module: 'boq',
        description: `BOQ ${b.item_code}: ${b.description || 'No desc'} — ${b.planned_quantity} ${b.unit} @ ₹${b.unit_rate}`,
        performed_at: b.last_change,
        performed_by_name: 'System',
        time_ago: timeAgo(b.last_change),
        boq_item_code: b.item_code,
        source: 'boq_items',
      });
    });
  } catch (err) {
    console.log('[DataFrequency] Recent activity query warning:', err.message);
  }

  // Sort by date descending and limit
  activity.sort((a, b) => new Date(b.performed_at) - new Date(a.performed_at));
  return activity.slice(0, 20);
}

// GET /api/projects/:id/data-frequency
router.get('/:id/data-frequency', verifyToken, async (req, res) => {
  try {
    const projectId = req.params.id;

    // 1. Get last 50 tracked events for this project
    const [events] = await db.execute(
      `SELECT de.*, u.name AS performed_by_name
       FROM data_events de
       LEFT JOIN users u ON de.performed_by = u.user_id
       WHERE de.project_id = ?
       ORDER BY de.performed_at DESC
       LIMIT 50`,
      [projectId]
    );

    // 2. Get module summary (count + last update per module) from tracked events
    const [moduleSummaryRows] = await db.execute(
      `SELECT 
         affected_module,
         COUNT(*) AS count,
         MAX(performed_at) AS last_updated,
         (SELECT de2.event_type FROM data_events de2 
          WHERE de2.project_id = ? AND de2.affected_module = de.affected_module 
          ORDER BY de2.performed_at DESC LIMIT 1) AS last_event
       FROM data_events de
       WHERE de.project_id = ?
       GROUP BY affected_module`,
      [projectId, projectId]
    );

    // Build module summary object
    let module_summary = {};
    for (const row of moduleSummaryRows) {
      module_summary[row.affected_module] = {
        count: row.count,
        last_updated: row.last_updated,
        last_event: row.last_event,
        time_ago: timeAgo(row.last_updated),
      };
    }

    // 3. If no tracked events, get fallback from real data tables
    const hasTrackedEvents = events.length > 0;
    if (!hasTrackedEvents) {
      const fallback = await getFallbackTimestamps(projectId);
      if (Object.keys(fallback).length > 0) {
        module_summary = fallback;
      }
    }

    // 4. Get project-level info
    const [projectRows] = await db.execute(
      `SELECT last_data_event_at, last_data_event_type, data_event_count, created_at, updated_at 
       FROM projects WHERE project_id = ?`,
      [projectId]
    );

    // Determine last update time — fallback to project updated_at or created_at
    let last_updated_at = projectRows[0]?.last_data_event_at;
    let last_event_type = projectRows[0]?.last_data_event_type;
    let last_updated_by = 'System';

    if (events.length > 0) {
      last_updated_by = events[0].performed_by_name || 'System';
    }

    // Fallback to real data timestamps if no tracked events
    if (!last_updated_at) {
      const allFallbackDates = Object.values(module_summary)
        .map(m => m.last_updated)
        .filter(Boolean)
        .sort((a, b) => new Date(b) - new Date(a));
      
      if (allFallbackDates.length > 0) {
        last_updated_at = allFallbackDates[0];
        last_event_type = 'excel_import';
      } else {
        // Last resort: project creation or update date
        last_updated_at = projectRows[0]?.updated_at || projectRows[0]?.created_at || null;
        last_event_type = 'project_created';
      }
    }

    // 5. Build events list — if no tracked events, use recent activity from tables
    let enrichedEvents = events.map(e => ({
      ...e,
      time_ago: timeAgo(e.performed_at),
      performed_by_name: e.performed_by_name || 'System',
    }));

    let recentActivity = [];
    if (!hasTrackedEvents) {
      recentActivity = await getRecentActivity(projectId);
    }

    const totalEvents = hasTrackedEvents
      ? (projectRows[0]?.data_event_count || events.length)
      : recentActivity.length;

    res.json({
      success: true,
      data: {
        project_id: projectId,
        last_updated_at,
        last_updated_by,
        last_event_type,
        total_events: totalEvents,
        events: hasTrackedEvents ? enrichedEvents : recentActivity,
        module_summary,
        has_tracked_events: hasTrackedEvents,
      }
    });
  } catch (err) {
    console.error('Data frequency error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/projects/:id/data-frequency/:module
router.get('/:id/data-frequency/:module', verifyToken, async (req, res) => {
  try {
    const { id: projectId, module: affectedModule } = req.params;
    const { boq_item_code } = req.query;

    let query = `SELECT de.*, u.name AS performed_by_name
       FROM data_events de
       LEFT JOIN users u ON de.performed_by = u.user_id
       WHERE de.project_id = ? AND de.affected_module = ?`;
    const params = [projectId, affectedModule];

    if (boq_item_code) {
      query += ' AND de.boq_item_code = ?';
      params.push(boq_item_code);
    }

    query += ' ORDER BY de.performed_at DESC LIMIT 50';

    const [events] = await db.execute(query, params);

    const enrichedEvents = events.map(e => ({
      ...e,
      time_ago: timeAgo(e.performed_at),
      performed_by_name: e.performed_by_name || 'System',
    }));

    // Module-level summary
    const totalCount = events.length;
    const lastEvent = events[0] || null;

    res.json({
      success: true,
      data: {
        project_id: projectId,
        module: affectedModule,
        total_events: totalCount,
        last_updated_at: lastEvent?.performed_at || null,
        last_updated_by: lastEvent?.performed_by_name || 'System',
        last_event_type: lastEvent?.event_type || null,
        events: enrichedEvents,
      }
    });
  } catch (err) {
    console.error('Data frequency module error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
