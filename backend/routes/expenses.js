const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/projects/:id/expenses
router.get('/:id/expenses', verifyToken, async (req, res) => {
  try {
    const { category } = req.query;
    let query = `SELECT e.*, u.name AS recorded_by_name FROM project_expenses e
                 LEFT JOIN users u ON e.recorded_by = u.user_id
                 WHERE e.project_id = ?`;
    const params = [req.params.id];
    if (category) { query += ' AND e.category = ?'; params.push(category); }
    query += ' ORDER BY e.expense_date DESC';

    const [rows] = await db.execute(query, params);

    // Summary
    const [summary] = await db.execute(
      `SELECT category, SUM(amount) AS total FROM project_expenses
       WHERE project_id = ? GROUP BY category`,
      [req.params.id]
    );

    res.json({ success: true, data: rows, summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/projects/:id/expenses
router.post('/:id/expenses', verifyToken, async (req, res) => {
  try {
    const {
      contract_id, category, sub_category, description, amount,
      expense_date, vendor_name, invoice_number, payment_status
    } = req.body;
    const expense_id = uuidv4();
    await db.execute(
      `INSERT INTO project_expenses
       (expense_id, project_id, contract_id, category, sub_category, description,
        amount, expense_date, vendor_name, invoice_number, payment_status, recorded_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [expense_id, req.params.id, contract_id||null, category, sub_category||null,
       description||null, amount, expense_date, vendor_name||null, invoice_number||null,
       payment_status||'pending', req.user.user_id]
    );
    res.status(201).json({ success: true, expense_id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
