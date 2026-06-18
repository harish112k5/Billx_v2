require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const fs       = require('fs');

const app = express();

// ── Middleware ────────────────────────────────────────────────
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Ensure upload directory exists
const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads/excel');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// ── Routes ────────────────────────────────────────────────────
const authRoutes          = require('./routes/auth');
const organizationRoutes  = require('./routes/organizations');
const projectRoutes       = require('./routes/projects');
const contractRoutes      = require('./routes/contracts');
const boqRoutes           = require('./routes/boq');
const raBillRoutes        = require('./routes/raBills');
const analyticsRoutes     = require('./routes/analytics');
const importRoutes        = require('./routes/import');
const investorRoutes      = require('./routes/investors');
const expenseRoutes       = require('./routes/expenses');
const adminRoutes         = require('./routes/admin');

app.use('/api/auth',          authRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/projects',      projectRoutes);
app.use('/api/projects',      contractRoutes);
app.use('/api/projects',      boqRoutes);
app.use('/api/projects',      raBillRoutes);
app.use('/api/ra-bills',      raBillRoutes);
app.use('/api/analytics',     analyticsRoutes);
app.use('/api/import',        importRoutes);
app.use('/api/investors',     investorRoutes);
app.use('/api/projects',      investorRoutes);
app.use('/api/projects',      expenseRoutes);
app.use('/api/admin',         adminRoutes);

// ── Health check ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'BillX V2 API is running',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// ── 404 handler ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.path}` });
});

// ── Error handler ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, error: err.message || 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 BillX V2 API running on http://localhost:${PORT}`);
  console.log(`📁 Upload directory: ${uploadDir}`);
});
