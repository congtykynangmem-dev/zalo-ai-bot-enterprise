const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateJWT, requireRole } = require('../middlewares/auth');
const { authLimiter } = require('../middlewares/rateLimiter');

// Login
router.post('/login', authLimiter, (req, res) => authController.login(req, res));

// Profile
router.get('/me', authenticateJWT, (req, res) => authController.getMe(req, res));

// Staff Management (Admin only)
router.post('/staff', authenticateJWT, requireRole(['admin']), (req, res) =>
  authController.createStaff(req, res)
);

router.get('/staff', authenticateJWT, requireRole(['admin']), (req, res) =>
  authController.listStaff(req, res)
);

module.exports = router;

