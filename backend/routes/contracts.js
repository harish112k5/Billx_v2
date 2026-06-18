const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/projects/:id/contracts
router.get('/:id/contracts', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT pc.*, o.org_name, o.org_type
       FROM project_contracts pc
       JOIN organizations o ON pc.organization_id = o.organization_id
       WHERE pc.project_id = ?
       ORDER BY pc.contract_type, pc.created_at`,
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/projects/:id/contracts
router.post('/:id/contracts', verifyToken, async (req, res) => {
  try {
    const {
      organization_id, contract_type, contract_number, contract_value,
      scope_description, start_date, end_date, parent_contract_id
    } = req.body;
    const contract_id = uuidv4();
    await db.execute(
      `INSERT INTO project_contracts
       (contract_id, project_id, organization_id, contract_type, contract_number,
        contract_value, scope_description, start_date, end_date, parent_contract_id)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [contract_id, req.params.id, organization_id, contract_type,
       contract_number||null, contract_value||0, scope_description||null,
       start_date||null, end_date||null, parent_contract_id||null]
    );
    res.status(201).json({ success: true, contract_id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/contracts/:id
router.get('/contracts/:id', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT pc.*, o.org_name, o.org_type, p.project_name, p.project_code
       FROM project_contracts pc
       JOIN organizations o ON pc.organization_id = o.organization_id
       JOIN projects p ON pc.project_id = p.project_id
       WHERE pc.contract_id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, error: 'Contract not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
