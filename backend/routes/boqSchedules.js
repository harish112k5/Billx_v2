/**
 * boqSchedules.js
 * Routes for BOQ schedule management and EVM analytics.
 */

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const scheduleEngine = require('../services/scheduleEngine');

// POST /api/projects/:projectId/boq-schedules
// Bulk create/update schedules for a project
router.post('/:projectId/boq-schedules', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { schedules } = req.body;
    const result = await scheduleEngine.bulkUpsertSchedules(projectId, schedules);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error creating schedules:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/projects/:projectId/boq-schedules
// List all schedules with optional filters
router.get('/:projectId/boq-schedules', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { boqId, fromDate, toDate } = req.query;
    const schedules = await scheduleEngine.getSchedules(projectId, { boqId, fromDate, toDate });
    res.json({ success: true, data: schedules });
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/projects/:projectId/boq-schedules/timeline
// Time-series data for charts (PV, EV, AC over time)
router.get('/:projectId/boq-schedules/timeline', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { asOfDate } = req.query;
    const timeline = await scheduleEngine.getTimeline(projectId, asOfDate);
    res.json({ success: true, data: timeline });
  } catch (error) {
    console.error('Error fetching timeline:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/projects/:projectId/boq-schedules/evm
// Earned Value Management metrics
router.get('/:projectId/boq-schedules/evm', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { asOfDate } = req.query;
    const evm = await scheduleEngine.calculateEVM(projectId, asOfDate || new Date());
    res.json({ success: true, data: evm });
  } catch (error) {
    console.error('Error calculating EVM:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/projects/:projectId/boq-schedules/generate
// Auto-generate default schedule from project dates
router.post('/:projectId/boq-schedules/generate', verifyToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const result = await scheduleEngine.generateDefaultSchedule(projectId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error generating schedule:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/boq-schedules/:scheduleId
router.put('/:scheduleId', verifyToken, async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const updates = req.body;
    const result = await scheduleEngine.updateSchedule(scheduleId, updates);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/boq-schedules/:scheduleId
router.delete('/:scheduleId', verifyToken, async (req, res) => {
  try {
    const { scheduleId } = req.params;
    await scheduleEngine.deleteSchedule(scheduleId);
    res.json({ success: true, message: 'Schedule deleted' });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
