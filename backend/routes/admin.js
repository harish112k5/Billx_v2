const express = require('express');
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/admin/stats
router.get('/stats', verifyToken, requireRole('super_admin', 'admin'), async (req, res) => {
  try {
    const [[projects]]  = await db.execute('SELECT COUNT(*) AS count FROM projects');
    const [[users]]     = await db.execute('SELECT COUNT(*) AS count FROM users WHERE is_active=1');
    const [[orgs]]      = await db.execute('SELECT COUNT(*) AS count FROM organizations WHERE is_active=1');
    const [[raBills]]   = await db.execute('SELECT COUNT(*) AS count FROM ra_bills');
    const [[boqItems]]  = await db.execute('SELECT COUNT(*) AS count FROM boq_items');
    const [[imports]]   = await db.execute('SELECT COUNT(*) AS count FROM excel_imports WHERE status="completed"');

    res.json({
      success: true,
      data: {
        projects:  projects.count,
        users:     users.count,
        orgs:      orgs.count,
        ra_bills:  raBills.count,
        boq_items: boqItems.count,
        imports:   imports.count
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/admin/users
router.get('/users', verifyToken, requireRole('super_admin', 'admin'), async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT u.user_id, u.name, u.email, u.role, u.is_active, u.last_login, u.created_at,
              o.org_name, o.org_type
       FROM users u JOIN organizations o ON u.organization_id = o.organization_id
       ORDER BY u.created_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
