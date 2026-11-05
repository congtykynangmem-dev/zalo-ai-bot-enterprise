const jwt = require('jsonwebtoken');
const env = require('../config/env');
const adminModel = require('../models/adminModel');

/**
 * Middleware to verify JWT token
 */
async function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token format' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);

    // Support master/emergency admin token
    if (decoded.id === '00000000-0000-0000-0000-000000000001') {
      req.user = {
        id: decoded.id,
        username: decoded.username,
        full_name: decoded.full_name,
        role: decoded.role,
        is_active: true
      };
      return next();
    }

    // Check if user still exists and is active in database
    try {
      const user = await adminModel.findById(decoded.id);
      if (!user || !user.is_active) {
        return res.status(401).json({ error: 'Tài khoản đã bị khóa hoặc không tồn tại.' });
      }
      req.user = user;
    } catch (dbErr) {
      // Fallback to token payload if database is momentarily busy
      req.user = {
        id: decoded.id,
        username: decoded.username,
        full_name: decoded.full_name,
        role: decoded.role,
        is_active: true
      };
    }

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token has expired. Please login again.' });
    }
    return res.status(403).json({ error: 'Forbidden: Invalid token' });
  }
}

/**
 * Middleware for Role-Based Access Control (RBAC)
 * @param {string[]} allowedRoles e.g. ['admin'] or ['admin', 'cskh']
 */
function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: Action requires one of roles: [${allowedRoles.join(', ')}]`
      });
    }

    next();
  };
}

module.exports = {
  authenticateJWT,
  requireRole
};

