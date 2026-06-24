/**
 * scheduleEngine.js
 * Core service for Time Dimension — schedule generation, EVM calculations, timeline data.
 */

const db = require('../db');
const { v4: uuidv4 } = require('uuid');

const scheduleEngine = {

  // ── Generate default monthly schedule from project dates + BOQ data ──
  async generateDefaultSchedule(projectId) {
    const [project] = await db.query(
      `SELECT start_date, end_date FROM projects WHERE project_id = ?`, [projectId]
    );
    if (!project.length) throw new Error('Project not found');
    if (!project[0].start_date || !project[0].end_date) {
      return { generated: false, reason: 'Project has no start/end dates' };
    }

    const start = new Date(project[0].start_date);
    const end = new Date(project[0].end_date);

    const [boqItems] = await db.query(
      `SELECT boq_id, planned_quantity, unit_rate FROM boq_items WHERE project_id = ?`,
      [projectId]
    );

    if (boqItems.length === 0) {
      return { generated: false, reason: 'No BOQ items found' };
    }

    const totalMonths = Math.max(1,
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth()) + 1
    );

    let count = 0;
    for (const item of boqItems) {
      const plannedQty = parseFloat(item.planned_quantity) || 0;
      const unitRate = parseFloat(item.unit_rate) || 0;
      const monthlyQty = parseFloat((plannedQty / totalMonths).toFixed(4));
      const monthlyAmt = parseFloat((monthlyQty * unitRate).toFixed(2));

      let current = new Date(start.getFullYear(), start.getMonth(), 1);
      const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

      while (current <= endMonth) {
        const periodStart = new Date(current.getFullYear(), current.getMonth(), 1);
        const periodEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);

        try {
          await db.query(
            `INSERT IGNORE INTO boq_item_schedules 
             (schedule_id, boq_id, project_id, period_start, period_end, planned_quantity, planned_amount)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [uuidv4(), item.boq_id, projectId,
             periodStart.toISOString().split('T')[0],
             periodEnd.toISOString().split('T')[0],
             monthlyQty, monthlyAmt]
          );
          count++;
        } catch (e) {
          // Skip duplicates
        }

        current.setMonth(current.getMonth() + 1);
      }
    }

    return { generated: true, totalItems: boqItems.length, schedulesCreated: count };
  },

  // ── Bulk upsert schedules from Excel import or frontend ──
  async bulkUpsertSchedules(projectId, schedules) {
    const results = [];
    for (const sched of schedules) {
      const [existing] = await db.query(
        `SELECT schedule_id FROM boq_item_schedules 
         WHERE boq_id = ? AND period_start = ?`,
        [sched.boq_id, sched.period_start]
      );

      if (existing.length > 0) {
        await db.query(
          `UPDATE boq_item_schedules 
           SET planned_quantity = ?, planned_amount = ?, updated_at = NOW()
           WHERE schedule_id = ?`,
          [sched.planned_quantity, sched.planned_amount, existing[0].schedule_id]
        );
        results.push({ action: 'updated', schedule_id: existing[0].schedule_id });
      } else {
        const id = uuidv4();
        await db.query(
          `INSERT INTO boq_item_schedules 
           (schedule_id, boq_id, project_id, period_start, period_end, planned_quantity, planned_amount)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, sched.boq_id, projectId, sched.period_start, sched.period_end,
           sched.planned_quantity, sched.planned_amount]
        );
        results.push({ action: 'created', schedule_id: id });
      }
    }
    return results;
  },

  // ── Get schedules with filters ──
  async getSchedules(projectId, filters = {}) {
    let query = `SELECT s.*, b.item_code, b.description, b.unit, b.unit_rate
                 FROM boq_item_schedules s
                 JOIN boq_items b ON s.boq_id = b.boq_id
                 WHERE s.project_id = ?`;
    const params = [projectId];

    if (filters.boqId) {
      query += ` AND s.boq_id = ?`;
      params.push(filters.boqId);
    }
    if (filters.fromDate) {
      query += ` AND s.period_start >= ?`;
      params.push(filters.fromDate);
    }
    if (filters.toDate) {
      query += ` AND s.period_end <= ?`;
      params.push(filters.toDate);
    }

    query += ` ORDER BY s.period_start, b.item_number`;
    const [rows] = await db.query(query, params);
    return rows;
  },

  // ── Get timeline data for charts (PV, EV, AC over time) ──
  async getTimeline(projectId, asOfDate = null) {
    let cutoff = '';
    const params = [projectId];

    if (asOfDate) {
      cutoff = `AND s.period_start <= ?`;
      params.push(asOfDate);
    }

    const [rows] = await db.query(`
      SELECT 
        s.period_start,
        s.period_end,
        SUM(s.planned_amount) as planned_value,
        SUM(s.actual_amount) as earned_value,
        SUM(s.planned_quantity) as planned_qty,
        SUM(s.actual_quantity) as actual_qty
      FROM boq_item_schedules s
      WHERE s.project_id = ? ${cutoff}
      GROUP BY s.period_start, s.period_end
      ORDER BY s.period_start
    `, params);

    // Get actual costs from expenses
    const [expenses] = await db.query(`
      SELECT 
        DATE_FORMAT(expense_date, '%Y-%m-01') as period_start,
        SUM(amount) as actual_cost
      FROM project_expenses
      WHERE project_id = ?
      GROUP BY DATE_FORMAT(expense_date, '%Y-%m-01')
      ORDER BY period_start
    `, [projectId]);

    // Build cumulative values
    let cumulativePV = 0, cumulativeEV = 0, cumulativeAC = 0;

    return rows.map(row => {
      const periodStr = typeof row.period_start === 'string'
        ? row.period_start
        : row.period_start.toISOString().split('T')[0];

      const expenseRow = expenses.find(e => e.period_start === periodStr);
      const periodAC = expenseRow ? parseFloat(expenseRow.actual_cost) : 0;

      cumulativePV += parseFloat(row.planned_value) || 0;
      cumulativeEV += parseFloat(row.earned_value) || 0;
      cumulativeAC += periodAC;

      return {
        period_start: periodStr,
        period_end: row.period_end,
        planned_value: parseFloat(row.planned_value) || 0,
        earned_value: parseFloat(row.earned_value) || 0,
        actual_cost: periodAC,
        cumulative_pv: cumulativePV,
        cumulative_ev: cumulativeEV,
        cumulative_ac: cumulativeAC,
        planned_qty: parseFloat(row.planned_qty) || 0,
        actual_qty: parseFloat(row.actual_qty) || 0,
        completion_pct: row.planned_qty > 0
          ? ((parseFloat(row.actual_qty) || 0) / parseFloat(row.planned_qty) * 100).toFixed(2)
          : 0
      };
    });
  },

  // ── Calculate EVM metrics ──
  async calculateEVM(projectId, asOfDate = new Date()) {
    const dateStr = typeof asOfDate === 'string' ? asOfDate : asOfDate.toISOString().split('T')[0];

    // Planned Value (PV): Sum of planned amounts up to asOfDate
    const [pvResult] = await db.query(`
      SELECT COALESCE(SUM(planned_amount), 0) as pv
      FROM boq_item_schedules
      WHERE project_id = ? AND period_start <= ?
    `, [projectId, dateStr]);
    const PV = parseFloat(pvResult[0].pv);

    // Earned Value (EV): Sum of actual amounts up to asOfDate
    const [evResult] = await db.query(`
      SELECT COALESCE(SUM(actual_amount), 0) as ev
      FROM boq_item_schedules
      WHERE project_id = ? AND period_start <= ?
    `, [projectId, dateStr]);
    const EV = parseFloat(evResult[0].ev);

    // Actual Cost (AC): Sum of expenses up to asOfDate
    const [acResult] = await db.query(`
      SELECT COALESCE(SUM(amount), 0) as ac
      FROM project_expenses
      WHERE project_id = ? AND expense_date <= ?
    `, [projectId, dateStr]);
    const AC = parseFloat(acResult[0].ac);

    // Calculate variances and indices
    const SV = EV - PV;
    const CV = EV - AC;
    const SPI = PV > 0 ? EV / PV : 0;
    const CPI = AC > 0 ? EV / AC : 0;

    // Forecasting
    const totalPlanned = await this.getTotalPlannedValue(projectId);
    const EAC = CPI > 0 ? totalPlanned / CPI : totalPlanned;
    const ETC = EAC - AC;
    const VAC = totalPlanned - EAC;

    return {
      asOfDate: dateStr,
      PV, EV, AC,
      SV, CV,
      SPI: parseFloat(SPI.toFixed(4)),
      CPI: parseFloat(CPI.toFixed(4)),
      EAC: parseFloat(EAC.toFixed(2)),
      ETC: parseFloat(ETC.toFixed(2)),
      VAC: parseFloat(VAC.toFixed(2)),
      totalPlanned: parseFloat(totalPlanned.toFixed(2)),
      status: {
        schedule: SPI >= 1 ? 'on_track' : SPI >= 0.9 ? 'at_risk' : 'behind',
        cost: CPI >= 1 ? 'on_budget' : CPI >= 0.9 ? 'at_risk' : 'over_budget'
      }
    };
  },

  async getTotalPlannedValue(projectId) {
    const [result] = await db.query(`
      SELECT COALESCE(SUM(planned_amount), 0) as total
      FROM boq_item_schedules
      WHERE project_id = ?
    `, [projectId]);
    return parseFloat(result[0].total);
  },

  async updateSchedule(scheduleId, updates) {
    const fields = [];
    const values = [];

    if (updates.planned_quantity !== undefined) {
      fields.push('planned_quantity = ?');
      values.push(updates.planned_quantity);
    }
    if (updates.planned_amount !== undefined) {
      fields.push('planned_amount = ?');
      values.push(updates.planned_amount);
    }
    if (updates.actual_quantity !== undefined) {
      fields.push('actual_quantity = ?');
      values.push(updates.actual_quantity);
    }
    if (updates.actual_amount !== undefined) {
      fields.push('actual_amount = ?');
      values.push(updates.actual_amount);
    }

    if (fields.length === 0) return { updated: false, reason: 'No fields to update' };

    values.push(scheduleId);
    await db.query(`UPDATE boq_item_schedules SET ${fields.join(', ')}, updated_at = NOW() WHERE schedule_id = ?`, values);
    return { updated: true };
  },

  async deleteSchedule(scheduleId) {
    await db.query(`DELETE FROM boq_item_schedules WHERE schedule_id = ?`, [scheduleId]);
    return { deleted: true };
  }
};

module.exports = scheduleEngine;
