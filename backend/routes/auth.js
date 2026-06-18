const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const db       = require('../db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' });
    }

    const [rows] = await db.execute(
      `SELECT u.*, o.org_name, o.org_type FROM users u
       JOIN organizations o ON u.organization_id = o.organization_id
       WHERE u.email = ? AND u.is_active = 1`,
      [email]
    );

    if (!rows.length) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Update last login
    await db.execute('UPDATE users SET last_login = NOW() WHERE user_id = ?', [user.user_id]);

    const token = jwt.sign(
      { user_id: user.user_id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        user_id:         user.user_id,
        name:            user.name,
        email:           user.email,
        role:            user.role,
        organization_id: user.organization_id,
        org_name:        user.org_name,
        org_type:        user.org_type,
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', verifyToken, async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT u.user_id, u.name, u.email, u.role, u.organization_id, u.last_login,
              o.org_name, o.org_type
       FROM users u JOIN organizations o ON u.organization_id = o.organization_id
       WHERE u.user_id = ?`,
      [req.user.user_id]
    );
    res.json({ success: true, user: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, organization_id } = req.body;
    if (!name || !email || !password || !role || !organization_id) {
      return res.status(400).json({ success: false, error: 'All fields required' });
    }
    const hash = await bcrypt.hash(password, 10);
    const { v4: uuidv4 } = require('uuid');
    const user_id = uuidv4();
    await db.execute(
      'INSERT INTO users (user_id, organization_id, name, email, password_hash, role) VALUES (?,?,?,?,?,?)',
      [user_id, organization_id, name, email, hash, role]
    );
    res.status(201).json({ success: true, user_id });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, error: 'Email already exists' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
