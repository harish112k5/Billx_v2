const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { verifyToken } = require('../middleware/auth');
const { logDataEvent } = require('../services/eventLogger');

const router = express.Router();

// GET /api/projects/:id/boq  — all items with progress
router.get('/:id/boq', verifyToken, async (req, res) => {
  try {
    const { category, status, is_non_boq, search } = req.query;
    let query = `SELECT * FROM v_boq_progress WHERE project_id = ?`;
    const params = [req.params.id];

    if (category) { query += ' AND category = ?'; params.push(category); }
    if (is_non_boq !== undefined) { query += ' AND is_non_boq = ?'; params.push(is_non_boq); }
    if (status) { query += ' AND status = ?'; params.push(status); }
    if (search) {
      query += ' AND (item_code LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    query += ' ORDER BY item_number ASC';

    const [rows] = await db.execute(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/projects/:id/boq/summary
router.get('/:id/boq/summary', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT
         COUNT(*)                                       AS total_items,
         SUM(CASE WHEN status='Completed'   THEN 1 ELSE 0 END) AS completed,
         SUM(CASE WHEN status='In Progress' THEN 1 ELSE 0 END) AS in_progress,
         SUM(CASE WHEN status='Not Started' THEN 1 ELSE 0 END) AS not_started,
         SUM(CASE WHEN status='Exceeded BOQ' THEN 1 ELSE 0 END) AS exceeded_boq,
         SUM(CASE WHEN is_non_boq=1         THEN 1 ELSE 0 END) AS non_boq_count,
         COALESCE(SUM(planned_amount),0)               AS total_planned_amount,
         COALESCE(SUM(executed_amount),0)              AS total_executed_amount,
         COALESCE(SUM(remaining_amount),0)             AS total_remaining_amount,
         ROUND(COALESCE(AVG(completion_percent),0),2)  AS avg_completion_percent
       FROM v_boq_progress WHERE project_id = ?`,
      [req.params.id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/projects/:id/boq — manual entry
router.post('/:id/boq', verifyToken, async (req, res) => {
  try {
    const {
      contract_id, item_code, item_number, description, unit,
      planned_quantity, unit_rate, category, phase, is_non_boq
    } = req.body;

    const boq_id = uuidv4();
    await db.execute(
      `INSERT INTO boq_items
       (boq_id, project_id, contract_id, item_code, item_number, description, unit,
        planned_quantity, unit_rate, category, phase, is_non_boq)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [boq_id, req.params.id, contract_id, item_code, item_number||null, description, unit,
       planned_quantity, unit_rate, category||null, phase||null, is_non_boq||0]
    );

    // Log data event
    await logDataEvent(db, req.params.id, 'manual_boq_entry', 'boq', {
      description: `Added BOQ item ${item_code}: ${description} — ${planned_quantity} ${unit} @ ₹${unit_rate}`,
      boq_item_code: item_code,
      amount_after: (parseFloat(planned_quantity) || 0) * (parseFloat(unit_rate) || 0),
      performed_by: req.user.user_id,
    });

    res.status(201).json({ success: true, boq_id });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, error: 'Item code already exists in this project' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/boq/:id/allocations
router.get('/boq/:boqId/allocations', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT a.*, o.org_name, o.org_type
       FROM boq_allocations a
       JOIN organizations o ON a.organization_id = o.organization_id
       WHERE a.boq_id = ?`,
      [req.params.boqId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/boq/:id/allocations
router.post('/boq/:boqId/allocations', verifyToken, async (req, res) => {
  try {
    const { organization_id, allocated_quantity, allocation_percent, allocated_rate, notes } = req.body;
    const allocation_id = uuidv4();
    await db.execute(
      `INSERT INTO boq_allocations
       (allocation_id, boq_id, organization_id, allocated_quantity, allocation_percent, allocated_rate, notes)
       VALUES (?,?,?,?,?,?,?)`,
      [allocation_id, req.params.boqId, organization_id, allocated_quantity,
       allocation_percent||null, allocated_rate||null, notes||null]
    );
    res.status(201).json({ success: true, allocation_id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/projects/:id/boq/:boqId/measurements
router.get('/:id/boq/:boqId/measurements', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT m.*, r.ra_number, r.ra_code
       FROM measurements m
       JOIN ra_bills r ON m.ra_bill_id = r.ra_bill_id
       WHERE m.boq_id = ?
       ORDER BY m.ipc_number, m.serial_no`,
      [req.params.boqId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
