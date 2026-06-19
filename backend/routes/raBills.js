const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/projects/:id/ra-bills
router.get('/:id/ra-bills', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT r.*, o.org_name AS contractor_name
       FROM ra_bills r
       JOIN project_contracts pc ON r.contract_id = pc.contract_id
       JOIN organizations o ON pc.organization_id = o.organization_id
       WHERE r.project_id = ?
       ORDER BY r.ra_number ASC`,
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/ra-bills/:id  — single RA bill with items
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const [bills] = await db.execute(
      `SELECT r.*, p.project_name, p.project_code, o.org_name AS contractor_name
       FROM ra_bills r
       JOIN projects p ON r.project_id = p.project_id
       JOIN project_contracts pc ON r.contract_id = pc.contract_id
       JOIN organizations o ON pc.organization_id = o.organization_id
       WHERE r.ra_bill_id = ?`,
      [req.params.id]
    );
    if (!bills.length) return res.status(404).json({ success: false, error: 'RA Bill not found' });

    const [items] = await db.execute(
      `SELECT ri.*, b.item_code, b.description, b.unit, b.planned_quantity, b.planned_amount, b.category
       FROM ra_bill_items ri
       JOIN boq_items b ON ri.boq_id = b.boq_id
       WHERE ri.ra_bill_id = ?
       ORDER BY b.item_number ASC`,
      [req.params.id]
    );

    res.json({ success: true, data: { ...bills[0], items } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/ra-bills/:id/items
router.get('/:id/items', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT ri.*, b.item_code, b.description, b.unit, b.planned_quantity, b.planned_amount, b.category
       FROM ra_bill_items ri
       JOIN boq_items b ON ri.boq_id = b.boq_id
       WHERE ri.ra_bill_id = ?
       ORDER BY b.item_number ASC`,
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/ra-bills/:id/measurements
router.get('/:id/measurements', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT m.*, b.item_code, b.description AS boq_description
       FROM measurements m
       JOIN boq_items b ON m.boq_id = b.boq_id
       WHERE m.ra_bill_id = ?
       ORDER BY b.item_number, m.serial_no`,
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/projects/:id/ra-bills — manual create
router.post('/:id/ra-bills', verifyToken, async (req, res) => {
  try {
    const {
      contract_id, ra_number, ra_code, bill_period_from, bill_period_to,
      basic_amount_this_bill, sgst_percent, cgst_percent,
      retention_percent, tds_percent, labour_cess_percent,
      prepared_by, submitted_to, ipc_number
    } = req.body;

    const basic  = parseFloat(basic_amount_this_bill) || 0;
    const sgst_p = parseFloat(sgst_percent) || 9;
    const cgst_p = parseFloat(cgst_percent) || 9;
    const ret_p  = parseFloat(retention_percent) || 5;
    const tds_p  = parseFloat(tds_percent) || 2;
    const lc_p   = parseFloat(labour_cess_percent) || 1;

    const sgst_amt   = basic * sgst_p / 100;
    const cgst_amt   = basic * cgst_p / 100;
    const gross      = basic + sgst_amt + cgst_amt;
    const ret_amt    = gross * ret_p / 100;
    const tds_amt    = basic * tds_p / 100;
    const lc_amt     = basic * lc_p / 100;
    const total_ded  = ret_amt + tds_amt + lc_amt;
    const net_pay    = gross - total_ded;

    const ra_bill_id = uuidv4();
    await db.execute(
      `INSERT INTO ra_bills
       (ra_bill_id, project_id, contract_id, ra_number, ra_code, bill_period_from, bill_period_to,
        basic_amount_this_bill, sgst_percent, cgst_percent, sgst_amount, cgst_amount,
        retention_percent, retention_amount, tds_percent, tds_amount,
        labour_cess_percent, labour_cess_amount, gross_amount, total_deductions, net_payable,
        ipc_number, prepared_by, submitted_to)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [ra_bill_id, req.params.id, contract_id, ra_number, ra_code||null,
       bill_period_from, bill_period_to, basic, sgst_p, cgst_p, sgst_amt, cgst_amt,
       ret_p, ret_amt, tds_p, tds_amt, lc_p, lc_amt, gross, total_ded, net_pay,
       ipc_number||null, prepared_by||null, submitted_to||null]
    );
    res.status(201).json({ success: true, ra_bill_id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/ra-bills/:id — update stage
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { stage, submitted_date, rejection_amount, rejection_reason } = req.body;
    await db.execute(
      `UPDATE ra_bills SET stage=?, submitted_date=?, rejection_amount=?, rejection_reason=?
       WHERE ra_bill_id=?`,
      [stage, submitted_date||null, rejection_amount||0, rejection_reason||null, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/ra-bills/:id/certify
router.put('/:id/certify', verifyToken, async (req, res) => {
  try {
    const { certified_amount, certified_date } = req.body;
    await db.execute(
      `UPDATE ra_bills SET stage='certified', certified_amount=?, certified_date=? WHERE ra_bill_id=?`,
      [certified_amount, certified_date, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/ra-bills/:id/payment
router.put('/:id/payment', verifyToken, async (req, res) => {
  try {
    const { payment_received, payment_date } = req.body;
    await db.execute(
      `UPDATE ra_bills SET payment_received=?, payment_date=?,
       stage = CASE WHEN ? >= certified_amount THEN 'paid' ELSE 'partially_paid' END
       WHERE ra_bill_id=?`,
      [payment_received, payment_date, payment_received, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
