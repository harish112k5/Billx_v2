const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const { v4: uuidv4 } = require('uuid');
const db       = require('../db');
const { verifyToken } = require('../middleware/auth');
const importPipeline  = require('../services/importPipeline');
const excelParser     = require('../services/excelParser');
const { logDataEvent } = require('../services/eventLogger');

const router = express.Router();

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads/excel');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ts = Date.now();
    cb(null, `${ts}_${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.includes('spreadsheetml') || file.originalname.endsWith('.xlsx')) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx files are accepted'));
    }
  }
});

// POST /api/import/preview — upload and parse for preview (Step 2)
router.post('/preview', verifyToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

    const preview = await excelParser.parsePreview(req.file.path, req.file.originalname);
    res.json({ success: true, data: preview, file_path: req.file.path, file_name: req.file.filename });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/import/ra-bill — confirm and execute import (Step 3)
router.post('/ra-bill', verifyToken, async (req, res) => {
  try {
    const { project_id, contract_id, file_path, file_name } = req.body;
    if (!project_id || !contract_id || !file_path) {
      return res.status(400).json({ success: false, error: 'project_id, contract_id and file_path required' });
    }

    const import_id = uuidv4();

    // Create import log entry
    await db.execute(
      `INSERT INTO excel_imports (import_id, project_id, contract_id, import_type, file_name, status, imported_by)
       VALUES (?,?,?,'ra_bill',?,?,?)`,
      [import_id, project_id, contract_id, file_name || 'uploaded.xlsx', 'processing', req.user.user_id]
    );

    // Run pipeline
    const result = await importPipeline.runRABillImport({
      project_id, contract_id, file_path, import_id, imported_by: req.user.user_id
    });

    // Update import log
    await db.execute(
      `UPDATE excel_imports
       SET status=?, ra_number_detected=?, boq_items_found=?, measurements_found=?,
           errors_count=?, error_log=?, completed_at=NOW(), ra_bill_id=?
       WHERE import_id=?`,
      [
        result.errors.length === 0 ? 'completed' : 'failed',
        result.ra_number, result.boq_items_processed, result.measurements_processed,
        result.errors.length, JSON.stringify(result.errors),
        result.ra_bill_id || null, import_id
      ]
    );

    // Log data event for frequency tracking
    await logDataEvent(db, project_id, 'excel_import', 'ra_bill', {
      description: `Imported RA Bill ${result.ra_number} — ${result.boq_items_processed} BOQ items, ${result.measurements_processed} measurements`,
      file_name: file_name || 'uploaded.xlsx',
      ra_bill_number: result.ra_number,
      amount_after: result.net_payable || 0,
      performed_by: req.user.user_id,
    });

    res.json({
      success: true,
      import_id,
      ra_bill: {
        ra_bill_id:  result.ra_bill_id,
        ra_number:   result.ra_number,
        bill_period: result.bill_period,
        net_payable: result.net_payable
      },
      stats: {
        boq_items_processed:  result.boq_items_processed,
        measurements_processed: result.measurements_processed,
        non_boq_items:        result.non_boq_items,
        errors:               result.errors
      }
    });
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/import/budget
router.post('/budget', verifyToken, upload.single('file'), async (req, res) => {
  try {
    const { project_id } = req.body;
    if (!project_id || !req.file) {
      return res.status(400).json({ success: false, error: 'project_id and file are required' });
    }

    const import_id = uuidv4();

    // Create import log entry
    await db.execute(
      `INSERT INTO excel_imports (import_id, project_id, import_type, file_name, status, imported_by)
       VALUES (?,?,'budget',?,?,?)`,
      [import_id, project_id, req.file.originalname, 'processing', req.user.user_id]
    );

    const summary = await importPipeline.runBudgetImport({
      project_id, file_path: req.file.path, import_id, imported_by: req.user.user_id
    });

    await db.execute(
      `UPDATE excel_imports SET status='completed', completed_at=NOW() WHERE import_id=?`,
      [import_id]
    );

    // Log data event for budget import
    await logDataEvent(db, project_id, 'excel_import', 'boq', {
      description: `Imported budget from Excel — ${summary?.items_created || 0} budget items`,
      file_name: req.file.originalname,
      performed_by: req.user.user_id,
    });

    res.json({ success: true, import_id, summary });

  } catch (err) {
    console.error('Budget import error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/import/history/:project_id
router.get('/history/:project_id', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT ei.*, u.name AS imported_by_name
       FROM excel_imports ei
       LEFT JOIN users u ON ei.imported_by = u.user_id
       WHERE ei.project_id = ?
       ORDER BY ei.imported_at DESC`,
      [req.params.project_id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
