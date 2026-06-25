const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { verifyToken } = require('../middleware/auth');
const analyticsEngine = require('../services/analyticsEngine');

const router = express.Router();

// ── Helper: compute budget status from percent ────────────────
function getBudgetStatus(percent) {
  if (percent < 70) return 'green';
  if (percent <= 90) return 'orange';
  return 'red';
}

// GET /api/projects
router.get('/', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT p.*, u.name AS created_by_name,
              COALESCE(r.total_ra_bills, 0) AS total_ra_bills,
              COALESCE(r.total_received, 0) AS total_received,
              COALESCE(b.total_boq_items, 0) AS total_boq_items,
              COALESCE(pe.total_expenses, 0) AS total_expenses,
              CASE 
                WHEN p.planned_budget > 0 
                THEN ROUND(COALESCE(pe.total_expenses, 0) / p.planned_budget * 100, 2)
                ELSE 0 
              END AS budget_used_percent
       FROM projects p
       LEFT JOIN users u ON p.created_by = u.user_id
       LEFT JOIN (
           SELECT project_id, COUNT(ra_bill_id) AS total_ra_bills, SUM(payment_received) AS total_received
           FROM ra_bills
           GROUP BY project_id
       ) r ON r.project_id = p.project_id
       LEFT JOIN (
           SELECT project_id, COUNT(boq_id) AS total_boq_items
           FROM boq_items
           GROUP BY project_id
       ) b ON b.project_id = p.project_id
       LEFT JOIN (
           SELECT project_id, SUM(amount) AS total_expenses
           FROM project_expenses
           GROUP BY project_id
       ) pe ON pe.project_id = p.project_id
       ORDER BY p.created_at DESC`
    );

    // Add computed budget_status, budget_used_percent, and current_profit
    const enriched = rows.map(p => {
      const totalExpenses = parseFloat(p.total_expenses) || 0;
      const plannedBudget = parseFloat(p.planned_budget) || 0;
      const budgetUsed = plannedBudget > 0 ? Math.round((totalExpenses / plannedBudget) * 10000) / 100 : 0;
      const totalReceived = parseFloat(p.total_received) || 0;
      const currentProfit = totalReceived - totalExpenses;
      return {
        ...p,
        budget_used_percent: budgetUsed,
        budget_status: getBudgetStatus(budgetUsed),
        current_profit: currentProfit,
      };
    });

    res.json({ success: true, data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/projects/:id
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT p.*, u.name AS created_by_name
       FROM projects p
       LEFT JOIN users u ON p.created_by = u.user_id
       WHERE p.project_id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Project not found' });

    // Get contracts
    const [contracts] = await db.execute(
      `SELECT pc.*, o.org_name, o.org_type FROM project_contracts pc
       JOIN organizations o ON pc.organization_id = o.organization_id
       WHERE pc.project_id = ?`,
      [req.params.id]
    );

    // Get financial summary
    const [expenseTotals] = await db.execute(
      `SELECT COALESCE(SUM(amount), 0) AS total_expenses FROM project_expenses WHERE project_id = ?`,
      [req.params.id]
    );
    const [revenueTotals] = await db.execute(
      `SELECT COALESCE(SUM(payment_received), 0) AS total_received FROM ra_bills WHERE project_id = ?`,
      [req.params.id]
    );
    const [expenseBreakdown] = await db.execute(
      `SELECT expense_type, COALESCE(SUM(amount), 0) AS total 
       FROM project_expenses WHERE project_id = ? GROUP BY expense_type`,
      [req.params.id]
    );

    const project = rows[0];
    const totalExpenses = parseFloat(expenseTotals[0].total_expenses) || 0;
    const totalReceived = parseFloat(revenueTotals[0].total_received) || 0;
    const plannedBudget = parseFloat(project.planned_budget) || 0;
    const plannedProfit = parseFloat(project.planned_profit) || 0;
    const budgetUsedPercent = plannedBudget > 0 ? Math.round((totalExpenses / plannedBudget) * 10000) / 100 : 0;
    const currentProfit = totalReceived - totalExpenses;
    const profitVariance = currentProfit - plannedProfit;

    // Build expense_breakdown object
    const breakdown = { material: 0, manpower: 0, machinery: 0, movement: 0, misc: 0 };
    expenseBreakdown.forEach(row => {
      if (breakdown.hasOwnProperty(row.expense_type)) {
        breakdown[row.expense_type] = parseFloat(row.total) || 0;
      }
    });

    res.json({
      success: true,
      data: {
        ...project,
        contracts,
        total_expenses: totalExpenses,
        total_received: totalReceived,
        budget_used_percent: budgetUsedPercent,
        budget_status: getBudgetStatus(budgetUsedPercent),
        current_profit: currentProfit,
        profit_variance: profitVariance,
        expense_breakdown: breakdown,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/projects/:id/dashboard
router.get('/:id/dashboard', verifyToken, async (req, res) => {
  try {
    const data = await analyticsEngine.getProjectDashboard(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/projects/:id/budget-overrun
router.get('/:id/budget-overrun', verifyToken, async (req, res) => {
  try {
    const [overrunItems] = await db.execute(
      `SELECT 
        b.boq_id,
        b.item_code,
        b.description,
        b.planned_amount,
        COALESCE(SUM(pe.amount), 0) AS actual_cost,
        b.planned_amount - COALESCE(SUM(pe.amount), 0) AS variance,
        CASE 
          WHEN b.planned_amount > 0 
          THEN ROUND((COALESCE(SUM(pe.amount), 0) - b.planned_amount) / b.planned_amount * 100, 2)
          ELSE 0 
        END AS overrun_percent
      FROM boq_items b
      LEFT JOIN project_expenses pe ON pe.boq_id = b.boq_id
      WHERE b.project_id = ?
      GROUP BY b.boq_id, b.item_code, b.description, b.planned_amount
      HAVING actual_cost > b.planned_amount
      ORDER BY overrun_percent DESC`,
      [req.params.id]
    );

    // Assign alert levels
    const items = overrunItems.map(item => ({
      ...item,
      actual_cost: parseFloat(item.actual_cost) || 0,
      variance: parseFloat(item.variance) || 0,
      overrun_percent: parseFloat(item.overrun_percent) || 0,
      alert_level: parseFloat(item.overrun_percent) > 50 ? 'severe' :
                   parseFloat(item.overrun_percent) > 20 ? 'critical' : 'warning',
    }));

    const totalOverrun = items.reduce((s, i) => s + Math.abs(i.variance), 0);

    // Get total BOQ count
    const [boqCount] = await db.execute(
      'SELECT COUNT(*) AS total FROM boq_items WHERE project_id = ?',
      [req.params.id]
    );

    res.json({
      success: true,
      data: {
        overrun_items: items,
        total_overrun_amount: totalOverrun,
        overrun_boq_count: items.length,
        total_boq_count: parseInt(boqCount[0].total) || 0,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/projects/:id/profit-analysis
router.get('/:id/profit-analysis', verifyToken, async (req, res) => {
  try {
    const [projectRows] = await db.execute(
      'SELECT planned_profit, planned_budget, contract_value FROM projects WHERE project_id = ?',
      [req.params.id]
    );
    if (!projectRows.length) return res.status(404).json({ success: false, error: 'Project not found' });

    const project = projectRows[0];
    const contractValue = parseFloat(project.contract_value) || 0;
    const plannedBudget = parseFloat(project.planned_budget) || 0;
    const plannedProfit = parseFloat(project.planned_profit) || 0;

    const [revRows] = await db.execute(
      'SELECT COALESCE(SUM(payment_received), 0) AS total_revenue FROM ra_bills WHERE project_id = ?',
      [req.params.id]
    );
    const [expRows] = await db.execute(
      'SELECT COALESCE(SUM(amount), 0) AS total_expenses FROM project_expenses WHERE project_id = ?',
      [req.params.id]
    );

    const totalRevenue = parseFloat(revRows[0].total_revenue) || 0;
    const totalExpenses = parseFloat(expRows[0].total_expenses) || 0;
    const currentProfit = totalRevenue - totalExpenses;
    const profitVariance = currentProfit - plannedProfit;
    const profitVariancePercent = plannedProfit > 0 ? Math.round((profitVariance / plannedProfit) * 10000) / 100 : 0;
    const remainingBudget = Math.max(0, plannedBudget - totalExpenses);
    const projectedFinalCost = totalExpenses + remainingBudget;
    const projectedFinalProfit = contractValue - projectedFinalCost;

    let profitHealth = 'healthy';
    if (currentProfit < plannedProfit) {
      profitHealth = profitVariancePercent >= -25 ? 'at_risk' : 'critical';
    }

    res.json({
      success: true,
      data: {
        contract_value: contractValue,
        planned_budget: plannedBudget,
        planned_profit: plannedProfit,
        total_revenue: totalRevenue,
        total_expenses: totalExpenses,
        current_profit: currentProfit,
        profit_variance: profitVariance,
        profit_variance_percent: profitVariancePercent,
        projected_final_cost: projectedFinalCost,
        projected_final_profit: projectedFinalProfit,
        profit_health: profitHealth,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/projects
router.post('/', verifyToken, async (req, res) => {
  try {
    const {
      project_code, project_name, project_location, client_name,
      work_order_number, work_order_date, contract_value, planned_profit,
      project_manager, start_date, end_date,
      status, description, contractor_id, subcontractor_id, subcontractor_ids
    } = req.body;

    // Budget formula validation
    const contractValue = parseFloat(contract_value) || 0;
    const plannedProfit = parseFloat(planned_profit) || 0;

    if (plannedProfit < 0) {
      return res.status(400).json({ success: false, error: 'Planned profit cannot be negative' });
    }
    if (plannedProfit > contractValue) {
      return res.status(400).json({ success: false, error: 'Planned profit cannot exceed contract value' });
    }

    const plannedBudget = contractValue - plannedProfit;

    const project_id = uuidv4();
    await db.execute(
      `INSERT INTO projects
       (project_id, project_code, project_name, project_location, client_name,
        work_order_number, work_order_date, contract_value, planned_budget, planned_profit,
        project_manager, start_date, end_date,
        status, description, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [project_id, project_code, project_name, project_location||null, client_name||null,
       work_order_number||null, work_order_date||null, contractValue,
       plannedBudget, plannedProfit, project_manager||null,
       start_date||null, end_date||null, status||'planned', description||null, req.user.user_id]
    );

    if (contractor_id) {
      const contract_id = uuidv4();
      await db.execute(
        `INSERT INTO project_contracts
         (contract_id, project_id, organization_id, contract_type, contract_value)
         VALUES (?, ?, ?, 'main', ?)`,
        [contract_id, project_id, contractor_id, contractValue]
      );
    }

    // Support both single subcontractor_id and array subcontractor_ids
    const subIds = subcontractor_ids || (subcontractor_id ? [subcontractor_id] : []);
    for (const subId of subIds) {
      if (!subId) continue;
      const contract_id = uuidv4();
      await db.execute(
        `INSERT INTO project_contracts
         (contract_id, project_id, organization_id, contract_type, contract_value)
         VALUES (?, ?, ?, 'subcontract', ?)`,
        [contract_id, project_id, subId, 0]
      );
    }

    res.status(201).json({
      success: true,
      project_id,
      planned_budget: plannedBudget,
      planned_profit: plannedProfit,
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, error: 'Project code already exists' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/projects/:id
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const {
      project_name, project_location, client_name, work_order_number,
      work_order_date, contract_value, planned_profit, project_manager,
      start_date, end_date, status, description,
      contractor_id, subcontractor_id, subcontractor_ids
    } = req.body;

    // Budget recalculation
    let plannedBudget = null;
    let finalPlannedProfit = null;
    if (contract_value !== undefined || planned_profit !== undefined) {
      const [currentRows] = await db.execute(
        'SELECT contract_value, planned_profit FROM projects WHERE project_id = ?',
        [req.params.id]
      );
      if (currentRows.length) {
        const current = currentRows[0];
        const newContractValue = contract_value !== undefined ? parseFloat(contract_value) : parseFloat(current.contract_value) || 0;
        finalPlannedProfit = planned_profit !== undefined ? parseFloat(planned_profit) : parseFloat(current.planned_profit) || 0;

        if (finalPlannedProfit < 0) {
          return res.status(400).json({ success: false, error: 'Planned profit cannot be negative' });
        }
        if (finalPlannedProfit > newContractValue) {
          return res.status(400).json({ success: false, error: 'Planned profit cannot exceed contract value' });
        }

        plannedBudget = newContractValue - finalPlannedProfit;
      }
    }

    await db.execute(
      `UPDATE projects SET project_name=?, project_location=?, client_name=?,
       work_order_number=?, work_order_date=?, contract_value=?,
       planned_budget=COALESCE(?, planned_budget),
       planned_profit=COALESCE(?, planned_profit),
       project_manager=COALESCE(?, project_manager),
       start_date=?, end_date=?, status=?, description=? WHERE project_id=?`,
      [project_name, project_location||null, client_name||null, work_order_number||null,
       work_order_date||null, contract_value||0,
       plannedBudget, finalPlannedProfit, project_manager !== undefined ? (project_manager||null) : null,
       start_date||null, end_date||null,
       status||'ongoing', description||null, req.params.id]
    );

    if (contractor_id) {
      const [existingContracts] = await db.execute(
        `SELECT contract_id FROM project_contracts WHERE project_id = ? AND contract_type = 'main'`,
        [req.params.id]
      );
      if (existingContracts.length > 0) {
        await db.execute(
          `UPDATE project_contracts SET organization_id = ?, contract_value = ? WHERE contract_id = ?`,
          [contractor_id, contract_value||0, existingContracts[0].contract_id]
        );
      } else {
        const contract_id_new = uuidv4();
        await db.execute(
          `INSERT INTO project_contracts
           (contract_id, project_id, organization_id, contract_type, contract_value)
           VALUES (?, ?, ?, 'main', ?)`,
          [contract_id_new, req.params.id, contractor_id, contract_value||0]
        );
      }
    }

    // Handle multiple subcontractors: remove old ones, insert new
    const subIds = subcontractor_ids || (subcontractor_id ? [subcontractor_id] : null);
    if (subIds) {
      await db.execute(
        `DELETE FROM project_contracts WHERE project_id = ? AND contract_type = 'subcontract'`,
        [req.params.id]
      );
      for (const subId of subIds) {
        if (!subId) continue;
        const cid = uuidv4();
        await db.execute(
          `INSERT INTO project_contracts
           (contract_id, project_id, organization_id, contract_type, contract_value)
           VALUES (?, ?, ?, 'subcontract', ?)`,
          [cid, req.params.id, subId, 0]
        );
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
// DELETE /api/projects/:id — Delete a project and all its associated data
router.delete('/:id', verifyToken, async (req, res) => {
  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    const projectId = req.params.id;

    // Delete in dependency order (children first)
    // 1. measurements
    await conn.execute(
      `DELETE m FROM measurements m 
       JOIN ra_bills rb ON m.ra_bill_id = rb.ra_bill_id 
       WHERE rb.project_id = ?`, [projectId]
    );
    // 2. ra_bill_items
    await conn.execute(
      `DELETE ri FROM ra_bill_items ri 
       JOIN ra_bills rb ON ri.ra_bill_id = rb.ra_bill_id 
       WHERE rb.project_id = ?`, [projectId]
    );
    // 3. excel_imports (if any)
    await conn.execute('DELETE FROM excel_imports WHERE project_id = ?', [projectId]);
    // 4. ra_bills
    await conn.execute('DELETE FROM ra_bills WHERE project_id = ?', [projectId]);
    // 5. project_expenses
    await conn.execute('DELETE FROM project_expenses WHERE project_id = ?', [projectId]);
    // 6. budget_items
    await conn.execute(
      `DELETE bi FROM budget_items bi 
       JOIN project_budgets pb ON bi.budget_id = pb.budget_id 
       WHERE pb.project_id = ?`, [projectId]
    );
    // 7. project_budgets
    await conn.execute('DELETE FROM project_budgets WHERE project_id = ?', [projectId]);
    // 8. boq_allocations
    await conn.execute(
      `DELETE ba FROM boq_allocations ba 
       JOIN boq_items bi ON ba.boq_id = bi.boq_id 
       WHERE bi.project_id = ?`, [projectId]
    );
    // 9. boq_items
    await conn.execute('DELETE FROM boq_items WHERE project_id = ?', [projectId]);
    // 10. project_contracts
    await conn.execute('DELETE FROM project_contracts WHERE project_id = ?', [projectId]);
    // 11. investments
    await conn.execute('DELETE FROM investments WHERE project_id = ?', [projectId]);
    // 12. finally, projects
    await conn.execute('DELETE FROM projects WHERE project_id = ?', [projectId]);

    await conn.commit();
    conn.release();
    res.json({ success: true, message: 'Project deleted successfully' });
  } catch (err) {
    await conn.rollback();
    conn.release();
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
