const express = require('express');
const router = express.Router();
const webhookConfigController = require('../controllers/webhookConfigController');
const { authenticateJWT, requireRole } = require('../middlewares/auth');

router.use(authenticateJWT);

// View config & logs (Admin and CSKH)
router.get('/', (req, res) => webhookConfigController.getConfig(req, res));
router.get('/logs', (req, res) => webhookConfigController.getLogs(req, res));

// Modify config, test, simulate (Admin only)
router.put('/', requireRole(['admin']), (req, res) => webhookConfigController.updateConfig(req, res));
router.post('/test-zalo', requireRole(['admin']), (req, res) => webhookConfigController.testConnection(req, res));
router.get('/zalo-info', requireRole(['admin']), (req, res) => webhookConfigController.getZaloInfo(req, res));
router.post('/set-webhook', requireRole(['admin']), (req, res) => webhookConfigController.setWebhook(req, res));
router.delete('/logs', requireRole(['admin']), (req, res) => webhookConfigController.clearLogs(req, res));
router.post('/simulate', requireRole(['admin']), (req, res) => webhookConfigController.simulateEvent(req, res));

module.exports = router;

