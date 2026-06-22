const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/projects/:id/expenses
router.get('/:id/expenses', verifyToken, async (req, res) => {
  try {
    const { category, expense_type, boq_id, from_date, to_date } = req.query;

    let query = `SELECT e.*, u.name AS recorded_by_name,
                        bi.description AS boq_description,
                        bi.item_code AS boq_item_code
                 FROM project_expenses e
                 LEFT JOIN users u ON e.recorded_by = u.user_id
                 LEFT JOIN boq_items bi ON bi.boq_id = e.boq_id
                 WHERE e.project_id = ?`;
    const params = [req.params.id];

    if (category)     { query += ' AND e.category = ?';      params.push(category); }
    if (expense_type) { query += ' AND e.expense_type = ?';  params.push(expense_type); }
    if (boq_id)       { query += ' AND e.boq_id = ?';        params.push(boq_id); }
    if (from_date)    { query += ' AND e.expense_date >= ?';  params.push(from_date); }
    if (to_date)      { query += ' AND e.expense_date <= ?';  params.push(to_date); }

    query += ' ORDER BY e.expense_date DESC, e.created_at DESC';

    const [rows] = await db.execute(query, params);

    // Summary by category
    const [summary] = await db.execute(
      `SELECT category, SUM(amount) AS total, COUNT(*) AS count FROM project_expenses
       WHERE project_id = ? GROUP BY category`,
      [req.params.id]
    );

    // Summary by expense_type
    const [typeSummary] = await db.execute(
      `SELECT expense_type, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count 
       FROM project_expenses
       WHERE project_id = ? GROUP BY expense_type`,
      [req.params.id]
    );

    res.json({ success: true, data: rows, summary, type_summary: typeSummary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/projects/:id/expenses
router.post('/:id/expenses', verifyToken, async (req, res) => {
  try {
    const {
      contract_id, expense_type, category, sub_category, description, amount,
      expense_date, vendor_name, invoice_number, payment_status,
      boq_id, quantity
    } = req.body;

    const newExpenseAmount = parseFloat(amount) || 0;
    if (newExpenseAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Amount must be greater than 0' });
    }

    // Budget validation (soft warning — NEVER block)
    let budgetWarning = null;
    const [projectRows] = await db.execute(
      `SELECT p.planned_budget, COALESCE(SUM(pe.amount), 0) AS total_spent 
       FROM projects p 
       LEFT JOIN project_expenses pe ON pe.project_id = p.project_id 
       WHERE p.project_id = ? 
       GROUP BY p.project_id`,
      [req.params.id]
    );

    if (projectRows.length > 0) {
      const plannedBudget = parseFloat(projectRows[0].planned_budget) || 0;
      const totalSpent = parseFloat(projectRows[0].total_spent) || 0;
      const projectedTotal = totalSpent + newExpenseAmount;

      if (plannedBudget > 0 && projectedTotal > plannedBudget) {
        budgetWarning = {
          warning: `This expense exceeds the planned budget. Total spent: ₹${projectedTotal.toLocaleString('en-IN')} / Budget: ₹${plannedBudget.toLocaleString('en-IN')}`,
          budget_exceeded: true,
          overrun_amount: projectedTotal - plannedBudget,
        };
      }
    }

    if (!budgetWarning && boq_id) {
      const [boqRows] = await db.execute(
        `SELECT planned_amount, actual_cost FROM boq_items WHERE boq_id = ?`, [boq_id]
      );
      if (boqRows.length > 0) {
        const pAmt = parseFloat(boqRows[0].planned_amount) || 0;
        const aCost = parseFloat(boqRows[0].actual_cost) || 0;
        const projectedBoqCost = aCost + newExpenseAmount;
        if (pAmt > 0 && projectedBoqCost > pAmt) {
          budgetWarning = {
            warning: `This expense exceeds the BOQ item planned amount. Total for item: ₹${projectedBoqCost.toLocaleString('en-IN')} / Planned: ₹${pAmt.toLocaleString('en-IN')}`,
            budget_exceeded: true,
            overrun_amount: projectedBoqCost - pAmt,
          };
        }
      }
    }

    // Insert expense
    const expense_id = uuidv4();
    await db.execute(
      `INSERT INTO project_expenses
       (expense_id, project_id, boq_id, contract_id, expense_type, category, sub_category, description,
        amount, quantity, expense_date, vendor_name, invoice_number, payment_status, recorded_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [expense_id, req.params.id, boq_id||null, contract_id||null,
       expense_type||'material', category||null, sub_category||null,
       description||null, newExpenseAmount, quantity||null,
       expense_date, vendor_name||null, invoice_number||null,
       payment_status||'pending', req.user.user_id]
    );

    // If boq_id provided, update boq_items.actual_cost
    if (boq_id) {
      await db.execute(
        `UPDATE boq_items SET actual_cost = (
           SELECT COALESCE(SUM(amount), 0) FROM project_expenses WHERE boq_id = ?
         ) WHERE boq_id = ?`,
        [boq_id, boq_id]
      );
    }

    const response = { success: true, expense_id };
    if (budgetWarning) {
      Object.assign(response, budgetWarning);
    }

    res.status(201).json(response);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
