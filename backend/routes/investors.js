const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/investors
router.get('/', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT i.*, u.name AS user_name,
              COALESCE(SUM(inv.amount), 0) AS total_invested,
              COALESCE(SUM(inv.repaid_amount), 0) AS total_repaid
       FROM investors i
       LEFT JOIN users u ON i.user_id = u.user_id
       LEFT JOIN investments inv ON inv.investor_id = i.investor_id
       GROUP BY i.investor_id
       ORDER BY i.name`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/investors
router.post('/', verifyToken, async (req, res) => {
  try {
    const { name, investor_type, contact_phone, contact_email, pan_number, address, user_id } = req.body;
    const investor_id = uuidv4();
    await db.execute(
      `INSERT INTO investors (investor_id, name, investor_type, contact_phone, contact_email, pan_number, address, user_id)
       VALUES (?,?,?,?,?,?,?,?)`,
      [investor_id, name, investor_type||'individual', contact_phone||null,
       contact_email||null, pan_number||null, address||null, user_id||null]
    );
    res.status(201).json({ success: true, investor_id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/projects/:id/investments
router.get('/:id/investments', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT inv.*, i.name AS investor_name, i.investor_type, i.contact_phone
       FROM investments inv
       JOIN investors i ON inv.investor_id = i.investor_id
       WHERE inv.project_id = ?
       ORDER BY inv.investment_date`,
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/projects/:id/investments
router.post('/:id/investments', verifyToken, async (req, res) => {
  try {
    const {
      investor_id, amount, investment_date, return_type,
      expected_return, return_percent, billing_milestone, notes
    } = req.body;
    const investment_id = uuidv4();
    await db.execute(
      `INSERT INTO investments
       (investment_id, project_id, investor_id, amount, investment_date, return_type,
        expected_return, return_percent, billing_milestone, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [investment_id, req.params.id, investor_id, amount, investment_date,
       return_type||'fixed_return', expected_return||0, return_percent||0,
       billing_milestone||null, notes||null]
    );
    res.status(201).json({ success: true, investment_id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/investments/:id/repayment
router.put('/investments/:id/repayment', verifyToken, async (req, res) => {
  try {
    const { repaid_amount, repayment_date } = req.body;
    await db.execute(
      `UPDATE investments SET repaid_amount=?, repayment_date=?,
       status = CASE WHEN ? >= amount THEN 'fully_repaid'
                     WHEN ? > 0 THEN 'partially_repaid'
                     ELSE 'active' END
       WHERE investment_id=?`,
      [repaid_amount, repayment_date, repaid_amount, repaid_amount, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
