const express = require('express');
const router = express.Router();
const { generateRABillTemplateV2, generateBudgetTemplateV2 } = require('../utils/templateGenerator');

// GET /api/templates/rabill-v2
router.get('/templates/rabill-v2', (req, res) => {
    try {
        const buffer = generateRABillTemplateV2();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="rabill_template_v2.xlsx"');
        res.send(buffer);
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to generate template' });
    }
});

// GET /api/templates/budget-v2
router.get('/templates/budget-v2', (req, res) => {
    try {
        const buffer = generateBudgetTemplateV2();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="budget_template_v2.xlsx"');
        res.send(buffer);
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to generate template' });
    }
});

module.exports = router;
