const express = require('express');
const db = require('../db');
const { verifyToken } = require('../middleware/auth');
const analyticsEngine = require('../services/analyticsEngine');

const router = express.Router();

// GET /api/analytics/project/:id
router.get('/project/:id', verifyToken, async (req, res) => {
  try {
    const data = await analyticsEngine.getProjectAnalytics(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/analytics/project/:id/boq-progress
router.get('/project/:id/boq-progress', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT item_code, description, unit, planned_quantity, planned_amount,
              executed_quantity, executed_amount, completion_percent, status, category
       FROM v_boq_progress WHERE project_id = ?
       ORDER BY planned_amount DESC LIMIT 30`,
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/analytics/project/:id/ra-trend
router.get('/project/:id/ra-trend', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT ra_number, ra_code, bill_period_from, bill_period_to,
              basic_amount_this_bill, basic_amount_upto_date,
              gross_amount, net_payable, certified_amount, payment_received,
              stage, retention_amount, tds_amount
       FROM ra_bills WHERE project_id = ?
       ORDER BY ra_number ASC`,
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/analytics/project/:id/cashflow
router.get('/project/:id/cashflow', verifyToken, async (req, res) => {
  try {
    const data = await analyticsEngine.getCashflow(req.params.id);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/analytics/contractor/:org_id
router.get('/contractor/:org_id', verifyToken, async (req, res) => {
  try {
    const [projects] = await db.execute(
      `SELECT p.project_id, p.project_name, p.project_code, p.contract_value, p.status,
              pc.contract_value AS contract_amount,
              COALESCE(SUM(r.payment_received), 0) AS total_received,
              COUNT(DISTINCT r.ra_bill_id) AS ra_count
       FROM project_contracts pc
       JOIN projects p ON pc.project_id = p.project_id
       LEFT JOIN ra_bills r ON r.contract_id = pc.contract_id
       WHERE pc.organization_id = ?
       GROUP BY p.project_id, pc.contract_id`,
      [req.params.org_id]
    );
    res.json({ success: true, data: projects });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/analytics/subcontractor/:org_id
router.get('/subcontractor/:org_id', verifyToken, async (req, res) => {
  try {
    const [allocs] = await db.execute(
      `SELECT a.*, b.item_code, b.description, b.unit, b.planned_quantity, b.planned_amount,
              p.project_name, p.project_code,
              vbp.executed_quantity, vbp.completion_percent, vbp.status
       FROM boq_allocations a
       JOIN boq_items b ON a.boq_id = b.boq_id
       JOIN projects p ON b.project_id = p.project_id
       LEFT JOIN v_boq_progress vbp ON vbp.boq_id = b.boq_id
       WHERE a.organization_id = ?`,
      [req.params.org_id]
    );
    res.json({ success: true, data: allocs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/analytics/investor/:investor_id
router.get('/investor/:investor_id', verifyToken, async (req, res) => {
  try {
    const [investments] = await db.execute(
      `SELECT i.*, p.project_name, p.project_code, p.status AS project_status,
              COALESCE(SUM(DISTINCT r.payment_received), 0) AS project_received,
              COALESCE(SUM(DISTINCT r.basic_amount_upto_date), 0) AS project_certified
       FROM investments i
       JOIN projects p ON i.project_id = p.project_id
       LEFT JOIN ra_bills r ON r.project_id = p.project_id
       WHERE i.investor_id = ?
       GROUP BY i.investment_id`,
      [req.params.investor_id]
    );
    res.json({ success: true, data: investments });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
