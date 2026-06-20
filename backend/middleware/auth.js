const jwt = require('jsonwebtoken');
const db  = require('../db');

/**
 * verifyToken — validates JWT in Authorization: Bearer <token>
 * Attaches req.user = { user_id, email, role, organization_id }
 */
const verifyToken = async (req, res, next) => {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_fallback_secret');
    // Refresh user from DB to get current role/active status
    const [rows] = await db.execute(
      'SELECT user_id, organization_id, name, email, role, is_active FROM users WHERE user_id = ?',
      [decoded.user_id]
    );
    if (!rows.length || !rows[0].is_active) {
      return res.status(401).json({ success: false, error: 'User not found or inactive' });
    }
    req.user = rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
};

/**
 * requireRole — restrict to specific roles
 * Usage: requireRole('admin', 'super_admin')
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, error: 'Unauthenticated' });
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: `Access denied. Required: ${roles.join(', ')}` });
  }
  next();
};

module.exports = { verifyToken, requireRole };
