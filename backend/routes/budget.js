const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const budgetEngine = require('../services/budgetEngine');

const router = express.Router({ mergeParams: true }); // Allows accessing :id from parent router if needed

// Note: Mounted at /api/projects
// So path is /:id/budget

// ── Helpers ────────────────────────────────────────────────────────
async function checkBudgetStatus(project_id, res) {
  const [b] = await db.execute('SELECT budget_id, status FROM project_budgets WHERE project_id = ?', [project_id]);
  if (!b.length) {
    res.status(404).json({ success: false, error: 'Budget not found' });
    return null;
  }
  return b[0];
}

// ── GET /api/projects/:id/budget ──────────────────────────────────
router.get('/:id/budget', verifyToken, async (req, res) => {
  try {
    const summary = await budgetEngine.getBudgetSummary(req.params.id);
    if (!summary) return res.json({ success: true, data: null }); // No budget yet
    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/projects/:id/budget ─────────────────────────────────
router.post('/:id/budget', verifyToken, requireRole('super_admin', 'admin', 'manager'), async (req, res) => {
  try {
    const { department, supervisor_name, currency } = req.body;
    const project_id = req.params.id;
    const budget_id = uuidv4();

    await db.execute(
      `INSERT INTO project_budgets (budget_id, project_id, department, supervisor_name, currency, status, created_by)
       VALUES (?, ?, ?, ?, ?, 'draft', ?)`,
      [budget_id, project_id, department || null, supervisor_name || null, currency || 'INR', req.user.user_id]
    );

    res.status(201).json({ success: true, budget_id });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, error: 'Budget already exists for this project' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PUT /api/projects/:id/budget ──────────────────────────────────
router.put('/:id/budget', verifyToken, requireRole('super_admin', 'admin', 'manager'), async (req, res) => {
  try {
    const budget = await checkBudgetStatus(req.params.id, res);
    if (!budget) return;
    if (budget.status === 'approved') {
      return res.status(403).json({ success: false, error: 'Cannot edit an approved budget' });
    }

    const { department, supervisor_name, currency, notes } = req.body;
    await db.execute(
      `UPDATE project_budgets SET department=?, supervisor_name=?, currency=?, notes=? WHERE project_id=?`,
      [department || null, supervisor_name || null, currency || 'INR', notes || null, req.params.id]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/projects/:id/budget/approve ─────────────────────────
router.post('/:id/budget/approve', verifyToken, requireRole('super_admin', 'admin'), async (req, res) => {
  try {
    const budget = await checkBudgetStatus(req.params.id, res);
    if (!budget) return;
    
    await db.execute(
      `UPDATE project_budgets SET status='approved' WHERE project_id=?`,
      [req.params.id]
    );
    res.json({ success: true, message: 'Budget approved' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/projects/:id/budget/revise ──────────────────────────
router.post('/:id/budget/revise', verifyToken, requireRole('super_admin', 'admin'), async (req, res) => {
  try {
    const budget = await checkBudgetStatus(req.params.id, res);
    if (!budget) return;

    const { revision_note } = req.body;
    if (!revision_note) return res.status(400).json({ success: false, error: 'Revision note is required' });

    // Append revision note to existing notes
    await db.execute(
      `UPDATE project_budgets 
       SET status='revised', 
           notes = CONCAT(COALESCE(notes, ''), '\\n\\n[Revision ', DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i'), '] ', ?) 
       WHERE project_id=?`,
      [revision_note, req.params.id]
    );
    res.json({ success: true, message: 'Budget opened for revision' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/projects/:id/budget/items ────────────────────────────
router.get('/:id/budget/items', verifyToken, async (req, res) => {
  try {
    const budget = await checkBudgetStatus(req.params.id, res);
    if (!budget) return;

    const [items] = await db.execute(
      `SELECT * FROM budget_items WHERE budget_id = ? ORDER BY display_order ASC`,
      [budget.budget_id]
    );
    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/projects/:id/budget/items ───────────────────────────
router.post('/:id/budget/items', verifyToken, requireRole('super_admin', 'admin', 'manager'), async (req, res) => {
  try {
    const budget = await checkBudgetStatus(req.params.id, res);
    if (!budget) return;
    if (budget.status === 'approved') {
      return res.status(403).json({ success: false, error: 'Cannot add items to an approved budget. Revise it first.' });
    }

    const item = req.body;
    const computed = budgetEngine.calculateBudgetItemAmounts(item);

    const budget_item_id = uuidv4();
    await db.execute(
      `INSERT INTO budget_items (
         budget_item_id, budget_id, wbs_code, task_name, assigned_to, category,
         planned_hours, actual_hours, labor_rate,
         planned_material_units, actual_material_units, material_rate,
         travel_cost, equipment_cost, fixed_cost, misc_cost,
         budgeted_amount, actual_amount, variance_amount, display_order
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        budget_item_id, budget.budget_id, item.wbs_code || null, item.task_name, item.assigned_to || null, item.category || 'Misc',
        item.planned_hours || 0, item.actual_hours || 0, item.labor_rate || 0,
        item.planned_material_units || 0, item.actual_material_units || 0, item.material_rate || 0,
        item.travel_cost || 0, item.equipment_cost || 0, item.fixed_cost || 0, item.misc_cost || 0,
        computed.budgeted_amount, computed.actual_amount, computed.variance_amount, item.display_order || 0
      ]
    );

    res.status(201).json({ success: true, budget_item_id, computed });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── PUT /api/projects/:id/budget/items/:itemId ────────────────────
router.put('/:id/budget/items/:itemId', verifyToken, requireRole('super_admin', 'admin', 'manager'), async (req, res) => {
  try {
    const budget = await checkBudgetStatus(req.params.id, res);
    if (!budget) return;
    if (budget.status === 'approved') {
      return res.status(403).json({ success: false, error: 'Cannot edit items in an approved budget. Revise it first.' });
    }

    const item = req.body;
    const computed = budgetEngine.calculateBudgetItemAmounts(item);

    await db.execute(
      `UPDATE budget_items SET
         wbs_code=?, task_name=?, assigned_to=?, category=?,
         planned_hours=?, actual_hours=?, labor_rate=?,
         planned_material_units=?, actual_material_units=?, material_rate=?,
         travel_cost=?, equipment_cost=?, fixed_cost=?, misc_cost=?,
         budgeted_amount=?, actual_amount=?, variance_amount=?, display_order=?
       WHERE budget_item_id=? AND budget_id=?`,
      [
        item.wbs_code || null, item.task_name, item.assigned_to || null, item.category || 'Misc',
        item.planned_hours || 0, item.actual_hours || 0, item.labor_rate || 0,
        item.planned_material_units || 0, item.actual_material_units || 0, item.material_rate || 0,
        item.travel_cost || 0, item.equipment_cost || 0, item.fixed_cost || 0, item.misc_cost || 0,
        computed.budgeted_amount, computed.actual_amount, computed.variance_amount, item.display_order || 0,
        req.params.itemId, budget.budget_id
      ]
    );

    res.json({ success: true, computed });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── DELETE /api/projects/:id/budget/items/:itemId ─────────────────
router.delete('/:id/budget/items/:itemId', verifyToken, requireRole('super_admin', 'admin', 'manager'), async (req, res) => {
  try {
    const budget = await checkBudgetStatus(req.params.id, res);
    if (!budget) return;
    if (budget.status === 'approved') {
      return res.status(403).json({ success: false, error: 'Cannot delete items from an approved budget. Revise it first.' });
    }

    await db.execute(
      `DELETE FROM budget_items WHERE budget_item_id=? AND budget_id=?`,
      [req.params.itemId, budget.budget_id]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
