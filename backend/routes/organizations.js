const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/organizations
router.get('/', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM organizations WHERE is_active = 1 ORDER BY org_name'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/organizations/:id
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM organizations WHERE organization_id = ?',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Organization not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/organizations
router.post('/', verifyToken, async (req, res) => {
  try {
    const { org_name, org_type, pan_number, gst_number, address, contact_person, contact_phone, contact_email } = req.body;
    const org_id = uuidv4();
    await db.execute(
      `INSERT INTO organizations
       (organization_id, org_name, org_type, pan_number, gst_number, address, contact_person, contact_phone, contact_email)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [org_id, org_name, org_type, pan_number||null, gst_number||null, address||null,
       contact_person||null, contact_phone||null, contact_email||null]
    );
    res.status(201).json({ success: true, organization_id: org_id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/organizations/:id
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { org_name, org_type, pan_number, gst_number, address, contact_person, contact_phone, contact_email, is_active } = req.body;
    await db.execute(
      `UPDATE organizations SET org_name=?, org_type=?, pan_number=?, gst_number=?, address=?,
       contact_person=?, contact_phone=?, contact_email=?, is_active=? WHERE organization_id=?`,
      [org_name, org_type, pan_number||null, gst_number||null, address||null,
       contact_person||null, contact_phone||null, contact_email||null, is_active ?? 1, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
