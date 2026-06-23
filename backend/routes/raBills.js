const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { verifyToken } = require('../middleware/auth');
const { logDataEvent } = require('../services/eventLogger');

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

    // Log data event
    await logDataEvent(db, req.params.id, 'manual_ra_bill', 'ra_bill', {
      description: `Created RA Bill RA-${ra_number} — Basic ₹${basic}, Net ₹${net_pay.toFixed(2)}`,
      ra_bill_number: ra_number,
      amount_after: net_pay,
      performed_by: req.user.user_id,
    });

    res.status(201).json({ success: true, ra_bill_id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/projects/:id/ra-bills/full — full manual create with BOQ items, Non-BOQ, and measurements
router.post('/:id/ra-bills/full', verifyToken, async (req, res) => {
  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    const projectId = req.params.id;
    const {
      contract_id, ra_number, ra_code, ipc_number,
      bill_period_from, bill_period_to,
      basic_amount_upto_date, basic_amount_upto_prev, basic_amount_this_bill,
      sgst_percent, cgst_percent, retention_percent, tds_percent, labour_cess_percent,
      prepared_by, submitted_to,
      boq_items = [],
      non_boq_items = []
    } = req.body;

    const basic   = parseFloat(basic_amount_this_bill) || 0;
    const sgst_p  = parseFloat(sgst_percent) || 9;
    const cgst_p  = parseFloat(cgst_percent) || 9;
    const ret_p   = parseFloat(retention_percent) || 5;
    const tds_p   = parseFloat(tds_percent) || 2;
    const lc_p    = parseFloat(labour_cess_percent) || 1;
    const sgst_amt = basic * sgst_p / 100;
    const cgst_amt = basic * cgst_p / 100;
    const gross    = basic + sgst_amt + cgst_amt;
    const ret_amt  = gross * ret_p / 100;
    const tds_amt  = basic * tds_p / 100;
    const lc_amt   = basic * lc_p / 100;
    const net_pay  = gross - ret_amt - tds_amt - lc_amt;

    // 1. Create ra_bill header
    const ra_bill_id = uuidv4();
    await conn.execute(
      `INSERT INTO ra_bills
       (ra_bill_id, project_id, contract_id, ra_number, ra_code, bill_period_from, bill_period_to,
        basic_amount_upto_date, basic_amount_upto_prev, basic_amount_this_bill,
        sgst_percent, cgst_percent, sgst_amount, cgst_amount,
        retention_percent, retention_amount, tds_percent, tds_amount,
        labour_cess_percent, labour_cess_amount, gross_amount, total_deductions, net_payable,
        ipc_number, prepared_by, submitted_to)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        ra_bill_id, projectId, contract_id,
        ra_number, ra_code || null, bill_period_from, bill_period_to,
        parseFloat(basic_amount_upto_date) || 0,
        parseFloat(basic_amount_upto_prev) || 0,
        basic,
        sgst_p, cgst_p, sgst_amt, cgst_amt,
        ret_p, ret_amt, tds_p, tds_amt,
        lc_p, lc_amt, gross,
        ret_amt + tds_amt + lc_amt, net_pay,
        ipc_number || null, prepared_by || null, submitted_to || null
      ]
    );

    // 2. Process BOQ items
    for (const item of boq_items) {
      if (!item.boq_id && !item.item_code) continue;

      let actualBoqId = item.boq_id;

      // If no existing boq_id, insert new BOQ item
      if (!actualBoqId) {
        actualBoqId = uuidv4();
        await conn.execute(
          `INSERT INTO boq_items
           (boq_id, project_id, contract_id, item_code, item_number, description, unit, planned_quantity, unit_rate)
           VALUES (?,?,?,?,?,?,?,?,?)
           ON DUPLICATE KEY UPDATE item_number=VALUES(item_number), description=VALUES(description),
             unit=VALUES(unit), planned_quantity=VALUES(planned_quantity), unit_rate=VALUES(unit_rate)`,
          [actualBoqId, projectId, contract_id, item.item_code, item.item_number || null,
           item.description, item.unit, parseFloat(item.planned_quantity) || 0, parseFloat(item.unit_rate) || 0]
        );
        const [boqRow] = await conn.execute(
          'SELECT boq_id FROM boq_items WHERE project_id=? AND item_code=?',
          [projectId, item.item_code]
        );
        actualBoqId = boqRow[0]?.boq_id || actualBoqId;
      }

      const qty_this   = parseFloat(item.qty_this_bill) || 0;
      const qty_upto   = parseFloat(item.qty_upto_date) || 0;
      const qty_prev   = parseFloat(item.qty_upto_previous) || 0;
      const rate       = parseFloat(item.unit_rate) || 0;
      const amt_this   = parseFloat(item.amount_this_bill) || qty_this * rate;
      const amt_upto   = parseFloat(item.amount_upto_date) || qty_upto * rate;
      const amt_prev   = parseFloat(item.amount_upto_previous) || qty_prev * rate;
      const planned_q  = parseFloat(item.planned_quantity) || 0;
      const planned_a  = planned_q * rate;

      // Insert ra_bill_item
      const ra_item_id = uuidv4();
      await conn.execute(
        `INSERT INTO ra_bill_items
         (ra_item_id, ra_bill_id, boq_id, qty_upto_date, qty_upto_previous, qty_this_bill,
          amount_upto_date, amount_upto_previous, amount_this_bill,
          qty_diff_from_boq, amount_diff_from_boq, unit_rate)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [ra_item_id, ra_bill_id, actualBoqId,
         qty_upto, qty_prev, qty_this,
         amt_upto, amt_prev, amt_this,
         qty_upto - planned_q, amt_upto - planned_a, rate]
      );

      // 3. Insert measurements for this BOQ item
      const measurements = item.measurements || [];
      for (const m of measurements) {
        if (!m.quantity && !m.description) continue;
        await conn.execute(
          `INSERT INTO measurements
           (measurement_id, ra_item_id, boq_id, ra_bill_id, serial_no, measurement_date,
            rfi_number, description, location_from, location_to, side, nos,
            length, breadth, depth, quantity, ipc_number, remarks)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            uuidv4(), ra_item_id, actualBoqId, ra_bill_id,
            m.serial_no || null, m.measurement_date || null,
            m.rfi_number || null, m.description || null,
            parseFloat(m.location_from) || null, parseFloat(m.location_to) || null,
            m.side || null, parseFloat(m.nos) || null,
            parseFloat(m.length) || null, parseFloat(m.breadth) || null,
            parseFloat(m.depth) || null, parseFloat(m.quantity) || 0,
            ipc_number || null, m.remarks || null
          ]
        );
      }
    }

    // 4. Process Non-BOQ items
    for (let i = 0; i < non_boq_items.length; i++) {
      const item = non_boq_items[i];
      if (!item.description) continue;
      const itemCode = 'NONBOQ-MANUAL-' + (i + 1) + '-' + Date.now();
      const boq_id   = uuidv4();
      const qty      = parseFloat(item.quantity) || 0;
      const rate     = parseFloat(item.unit_rate) || 0;
      const amount   = parseFloat(item.amount) || qty * rate;

      await conn.execute(
        `INSERT INTO boq_items
         (boq_id, project_id, contract_id, item_code, description, unit, planned_quantity, unit_rate, is_non_boq)
         VALUES (?,?,?,?,?,?,?,?,1)`,
        [boq_id, projectId, contract_id, itemCode, item.description, item.unit || 'LS', qty, rate]
      );

      const ra_item_id = uuidv4();
      await conn.execute(
        `INSERT INTO ra_bill_items
         (ra_item_id, ra_bill_id, boq_id, qty_this_bill, amount_this_bill,
          qty_upto_date, amount_upto_date, unit_rate, is_non_boq)
         VALUES (?,?,?,?,?,?,?,?,1)`,
        [ra_item_id, ra_bill_id, boq_id, qty, amount, qty, amount, rate]
      );
    }

    await conn.commit();

    // Log data event (use main db pool since conn is about to be released)
    await logDataEvent(db, projectId, 'manual_ra_bill', 'ra_bill', {
      description: `Created RA Bill RA-${ra_number} (full) — ${boq_items.length} BOQ items, ${non_boq_items.length} Non-BOQ items, Net ₹${net_pay.toFixed(2)}`,
      ra_bill_number: ra_number,
      amount_after: net_pay,
      performed_by: req.user.user_id,
    });

    conn.release();
    res.status(201).json({ success: true, ra_bill_id });
  } catch (err) {
    await conn.rollback();
    conn.release();
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/ra-bills/:id — update stage
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { stage, submitted_date, rejection_amount, rejection_reason } = req.body;

    // Get current bill info for logging
    const [oldBill] = await db.execute('SELECT project_id, ra_number, stage AS old_stage FROM ra_bills WHERE ra_bill_id=?', [req.params.id]);

    await db.execute(
      `UPDATE ra_bills SET stage=?, submitted_date=?, rejection_amount=?, rejection_reason=?
       WHERE ra_bill_id=?`,
      [stage, submitted_date||null, rejection_amount||0, rejection_reason||null, req.params.id]
    );

    // Log data event
    if (oldBill.length > 0) {
      await logDataEvent(db, oldBill[0].project_id, 'stage_changed', 'ra_bill', {
        description: `RA Bill RA-${oldBill[0].ra_number} stage: ${oldBill[0].old_stage} → ${stage}`,
        ra_bill_number: oldBill[0].ra_number,
        performed_by: req.user.user_id,
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/ra-bills/:id/certify
router.put('/:id/certify', verifyToken, async (req, res) => {
  try {
    const { certified_amount, certified_date } = req.body;

    // Get bill info for logging
    const [bill] = await db.execute('SELECT project_id, ra_number FROM ra_bills WHERE ra_bill_id=?', [req.params.id]);

    await db.execute(
      `UPDATE ra_bills SET stage='certified', certified_amount=?, certified_date=? WHERE ra_bill_id=?`,
      [certified_amount, certified_date, req.params.id]
    );

    // Log data event
    if (bill.length > 0) {
      await logDataEvent(db, bill[0].project_id, 'stage_changed', 'ra_bill', {
        description: `RA Bill RA-${bill[0].ra_number} certified — ₹${certified_amount}`,
        ra_bill_number: bill[0].ra_number,
        amount_after: parseFloat(certified_amount) || 0,
        performed_by: req.user.user_id,
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/ra-bills/:id/payment
router.put('/:id/payment', verifyToken, async (req, res) => {
  try {
    const { payment_received, payment_date } = req.body;

    // Get bill info for logging
    const [bill] = await db.execute('SELECT project_id, ra_number, payment_received AS old_payment FROM ra_bills WHERE ra_bill_id=?', [req.params.id]);

    await db.execute(
      `UPDATE ra_bills SET payment_received=?, payment_date=?,
       stage = CASE WHEN ? >= certified_amount THEN 'paid' ELSE 'partially_paid' END
       WHERE ra_bill_id=?`,
      [payment_received, payment_date, payment_received, req.params.id]
    );

    // Log data event
    if (bill.length > 0) {
      await logDataEvent(db, bill[0].project_id, 'payment_recorded', 'payments', {
        description: `RA Bill RA-${bill[0].ra_number} payment: ₹${payment_received}`,
        ra_bill_number: bill[0].ra_number,
        amount_before: parseFloat(bill[0].old_payment) || 0,
        amount_after: parseFloat(payment_received) || 0,
        performed_by: req.user.user_id,
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/ra-bills/:id - Hard delete an RA bill and all its associated data
router.delete('/:id', verifyToken, async (req, res) => {
  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    const raId = req.params.id;

    // Delete in order to respect constraints (even if not strictly enforced, it's safer)
    await conn.execute('DELETE FROM measurements WHERE ra_bill_id = ?', [raId]);
    await conn.execute('DELETE FROM ra_bill_items WHERE ra_bill_id = ?', [raId]);
    await conn.execute('DELETE FROM excel_imports WHERE ra_bill_id = ?', [raId]);
    await conn.execute('DELETE FROM ra_bills WHERE ra_bill_id = ?', [raId]);

    await conn.commit();
    conn.release();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    conn.release();
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/ra-bills/:id/items — add a single BOQ item to an existing RA Bill
router.post('/:id/items', verifyToken, async (req, res) => {
  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    const ra_bill_id = req.params.id;

    // Get RA bill info
    const [bills] = await conn.execute('SELECT project_id, contract_id, ipc_number FROM ra_bills WHERE ra_bill_id=?', [ra_bill_id]);
    if (!bills.length) { conn.release(); return res.status(404).json({ success: false, error: 'RA Bill not found' }); }
    const { project_id, contract_id, ipc_number } = bills[0];

    const {
      boq_id, item_code, item_number, description, unit,
      planned_quantity, unit_rate,
      qty_upto_previous, qty_upto_date, qty_this_bill,
      amount_upto_previous, amount_upto_date, amount_this_bill,
      is_non_boq,
      measurements = []
    } = req.body;

    let actualBoqId = boq_id;

    // Create new BOQ item if no existing one
    if (!actualBoqId) {
      actualBoqId = uuidv4();
      await conn.execute(
        `INSERT INTO boq_items
         (boq_id, project_id, contract_id, item_code, item_number, description, unit, planned_quantity, unit_rate, is_non_boq)
         VALUES (?,?,?,?,?,?,?,?,?,?)
         ON DUPLICATE KEY UPDATE item_number=VALUES(item_number), description=VALUES(description),
           unit=VALUES(unit), planned_quantity=VALUES(planned_quantity), unit_rate=VALUES(unit_rate)`,
        [actualBoqId, project_id, contract_id, item_code || ('MANUAL-' + Date.now()),
         item_number || null, description, unit || 'LS',
         parseFloat(planned_quantity) || 0, parseFloat(unit_rate) || 0,
         is_non_boq ? 1 : 0]
      );
      // Re-read to handle ON DUPLICATE KEY
      const [boqRow] = await conn.execute(
        'SELECT boq_id FROM boq_items WHERE project_id=? AND item_code=?',
        [project_id, item_code]
      );
      if (boqRow.length) actualBoqId = boqRow[0].boq_id;
    }

    const qty_this = parseFloat(qty_this_bill) || 0;
    const qty_upto = parseFloat(qty_upto_date) || 0;
    const qty_prev = parseFloat(qty_upto_previous) || 0;
    const rate     = parseFloat(unit_rate) || 0;
    const amt_this = parseFloat(amount_this_bill) || qty_this * rate;
    const amt_upto = parseFloat(amount_upto_date) || qty_upto * rate;
    const amt_prev = parseFloat(amount_upto_previous) || qty_prev * rate;
    const planned_q = parseFloat(planned_quantity) || 0;

    const ra_item_id = uuidv4();
    await conn.execute(
      `INSERT INTO ra_bill_items
       (ra_item_id, ra_bill_id, boq_id, qty_upto_date, qty_upto_previous, qty_this_bill,
        amount_upto_date, amount_upto_previous, amount_this_bill,
        qty_diff_from_boq, amount_diff_from_boq, unit_rate, is_non_boq)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [ra_item_id, ra_bill_id, actualBoqId,
       qty_upto, qty_prev, qty_this,
       amt_upto, amt_prev, amt_this,
       qty_upto - planned_q, (amt_upto) - (planned_q * rate), rate,
       is_non_boq ? 1 : 0]
    );

    // Insert measurements
    for (const m of measurements) {
      if (!m.quantity && !m.description) continue;
      await conn.execute(
        `INSERT INTO measurements
         (measurement_id, ra_item_id, boq_id, ra_bill_id, serial_no, measurement_date,
          rfi_number, description, location_from, location_to, side, nos,
          length, breadth, depth, quantity, ipc_number, remarks)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          uuidv4(), ra_item_id, actualBoqId, ra_bill_id,
          m.serial_no || null, m.measurement_date || null,
          m.rfi_number || null, m.description || null,
          parseFloat(m.location_from) || null, parseFloat(m.location_to) || null,
          m.side || null, parseFloat(m.nos) || null,
          parseFloat(m.length) || null, parseFloat(m.breadth) || null,
          parseFloat(m.depth) || null, parseFloat(m.quantity) || 0,
          ipc_number || null, m.remarks || null
        ]
      );
    }

    // Recalculate RA bill basic_amount_this_bill from sum of items
    await conn.execute(
      `UPDATE ra_bills SET
       basic_amount_this_bill = (SELECT COALESCE(SUM(amount_this_bill),0) FROM ra_bill_items WHERE ra_bill_id=?),
       basic_amount_upto_date = (SELECT COALESCE(SUM(amount_upto_date),0) FROM ra_bill_items WHERE ra_bill_id=?)
       WHERE ra_bill_id=?`,
      [ra_bill_id, ra_bill_id, ra_bill_id]
    );

    await conn.commit();
    conn.release();
    res.status(201).json({ success: true, ra_item_id });
  } catch (err) {
    await conn.rollback();
    conn.release();
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/ra-bills/:id/items/:itemId — update an existing BOQ item in an RA Bill
router.put('/:id/items/:itemId', verifyToken, async (req, res) => {
  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    const { id: ra_bill_id, itemId: ra_item_id } = req.params;
    const {
      qty_upto_previous, qty_upto_date, qty_this_bill,
      amount_upto_previous, amount_upto_date, amount_this_bill,
      unit_rate, measurements = []
    } = req.body;

    const qty_this = parseFloat(qty_this_bill) || 0;
    const rate     = parseFloat(unit_rate) || 0;
    const qty_upto = parseFloat(qty_upto_date) || 0;
    const qty_prev = parseFloat(qty_upto_previous) || 0;
    const amt_this = parseFloat(amount_this_bill) || qty_this * rate;
    const amt_upto = parseFloat(amount_upto_date) || qty_upto * rate;
    const amt_prev = parseFloat(amount_upto_previous) || qty_prev * rate;

    await conn.execute(
      `UPDATE ra_bill_items SET
       qty_upto_date=?, qty_upto_previous=?, qty_this_bill=?,
       amount_upto_date=?, amount_upto_previous=?, amount_this_bill=?, unit_rate=?
       WHERE ra_item_id=?`,
      [qty_upto, qty_prev, qty_this, amt_upto, amt_prev, amt_this, rate, ra_item_id]
    );

    // Replace measurements: delete old, insert new
    if (measurements.length > 0) {
      await conn.execute('DELETE FROM measurements WHERE ra_item_id=?', [ra_item_id]);
      const [itemRow] = await conn.execute('SELECT boq_id FROM ra_bill_items WHERE ra_item_id=?', [ra_item_id]);
      const boq_id = itemRow[0]?.boq_id;
      const [billRow] = await conn.execute('SELECT ipc_number FROM ra_bills WHERE ra_bill_id=?', [ra_bill_id]);
      const ipc = billRow[0]?.ipc_number;

      for (const m of measurements) {
        if (!m.quantity && !m.description) continue;
        await conn.execute(
          `INSERT INTO measurements
           (measurement_id, ra_item_id, boq_id, ra_bill_id, serial_no, measurement_date,
            rfi_number, description, location_from, location_to, side, nos,
            length, breadth, depth, quantity, ipc_number, remarks)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            uuidv4(), ra_item_id, boq_id, ra_bill_id,
            m.serial_no || null, m.measurement_date || null,
            m.rfi_number || null, m.description || null,
            parseFloat(m.location_from) || null, parseFloat(m.location_to) || null,
            m.side || null, parseFloat(m.nos) || null,
            parseFloat(m.length) || null, parseFloat(m.breadth) || null,
            parseFloat(m.depth) || null, parseFloat(m.quantity) || 0,
            ipc || null, m.remarks || null
          ]
        );
      }
    }

    // Recalculate RA bill totals
    await conn.execute(
      `UPDATE ra_bills SET
       basic_amount_this_bill = (SELECT COALESCE(SUM(amount_this_bill),0) FROM ra_bill_items WHERE ra_bill_id=?),
       basic_amount_upto_date = (SELECT COALESCE(SUM(amount_upto_date),0) FROM ra_bill_items WHERE ra_bill_id=?)
       WHERE ra_bill_id=?`,
      [ra_bill_id, ra_bill_id, ra_bill_id]
    );

    await conn.commit();
    conn.release();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    conn.release();
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/ra-bills/:id/items/:itemId — remove a BOQ item from an RA Bill
router.delete('/:id/items/:itemId', verifyToken, async (req, res) => {
  const conn = await db.getConnection();
  await conn.beginTransaction();
  try {
    const { id: ra_bill_id, itemId: ra_item_id } = req.params;
    await conn.execute('DELETE FROM measurements WHERE ra_item_id=?', [ra_item_id]);
    await conn.execute('DELETE FROM ra_bill_items WHERE ra_item_id=?', [ra_item_id]);

    // Recalculate RA bill totals
    await conn.execute(
      `UPDATE ra_bills SET
       basic_amount_this_bill = (SELECT COALESCE(SUM(amount_this_bill),0) FROM ra_bill_items WHERE ra_bill_id=?),
       basic_amount_upto_date = (SELECT COALESCE(SUM(amount_upto_date),0) FROM ra_bill_items WHERE ra_bill_id=?)
       WHERE ra_bill_id=?`,
      [ra_bill_id, ra_bill_id, ra_bill_id]
    );

    await conn.commit();
    conn.release();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    conn.release();
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
