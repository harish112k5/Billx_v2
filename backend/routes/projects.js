const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { verifyToken } = require('../middleware/auth');
const analyticsEngine = require('../services/analyticsEngine');

const router = express.Router();

// GET /api/projects
router.get('/', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT p.*, u.name AS created_by_name,
              COUNT(DISTINCT r.ra_bill_id) AS total_ra_bills,
              COALESCE(SUM(DISTINCT r.payment_received), 0) AS total_received,
              COUNT(DISTINCT b.boq_id) AS total_boq_items
       FROM projects p
       LEFT JOIN users u          ON p.created_by = u.user_id
       LEFT JOIN ra_bills r       ON r.project_id  = p.project_id
       LEFT JOIN boq_items b      ON b.project_id  = p.project_id
       GROUP BY p.project_id
       ORDER BY p.created_at DESC`
    );
    res.json({ success: true, data: rows });
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
    res.json({ success: true, data: { ...rows[0], contracts } });
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

// POST /api/projects
router.post('/', verifyToken, async (req, res) => {
  try {
    const {
      project_code, project_name, project_location, client_name,
      work_order_number, work_order_date, contract_value, start_date, end_date,
      status, description, contractor_id, subcontractor_id, subcontractor_ids
    } = req.body;

    const project_id = uuidv4();
    await db.execute(
      `INSERT INTO projects
       (project_id, project_code, project_name, project_location, client_name,
        work_order_number, work_order_date, contract_value, start_date, end_date,
        status, description, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [project_id, project_code, project_name, project_location||null, client_name||null,
       work_order_number||null, work_order_date||null, contract_value||0,
       start_date||null, end_date||null, status||'planned', description||null, req.user.user_id]
    );

    if (contractor_id) {
      const contract_id = uuidv4();
      await db.execute(
        `INSERT INTO project_contracts
         (contract_id, project_id, organization_id, contract_type, contract_value)
         VALUES (?, ?, ?, 'main', ?)`,
        [contract_id, project_id, contractor_id, contract_value||0]
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

    res.status(201).json({ success: true, project_id });
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
      work_order_date, contract_value, start_date, end_date, status, description,
      contractor_id, subcontractor_id, subcontractor_ids
    } = req.body;
    await db.execute(
      `UPDATE projects SET project_name=?, project_location=?, client_name=?,
       work_order_number=?, work_order_date=?, contract_value=?, start_date=?,
       end_date=?, status=?, description=? WHERE project_id=?`,
      [project_name, project_location||null, client_name||null, work_order_number||null,
       work_order_date||null, contract_value||0, start_date||null, end_date||null,
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
        const contract_id = uuidv4();
        await db.execute(
          `INSERT INTO project_contracts
           (contract_id, project_id, organization_id, contract_type, contract_value)
           VALUES (?, ?, ?, 'main', ?)`,
          [contract_id, req.params.id, contractor_id, contract_value||0]
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

module.exports = router;
