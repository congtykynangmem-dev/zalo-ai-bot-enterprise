const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const { verifyZaloMAC } = require('../middlewares/zaloSecurity');
const { webhookLimiter } = require('../middlewares/rateLimiter');
const zaloService = require('../services/zaloService');

// Zalo Webhook verification (GET /webhook)
router.get('/webhook', (req, res) => webhookController.verifyWebhook(req, res));

// Zalo Real-time Webhook Receiver (POST /webhook)
router.post('/webhook', webhookLimiter, verifyZaloMAC, (req, res) =>
  webhookController.handleWebhook(req, res)
);

// Backward-compatible endpoint (POST /send-message)
router.post('/send-message', async (req, res) => {
  const { user_id, message } = req.body;
  if (!user_id || !message) {
    return res.status(400).json({ error: 'Missing user_id or message' });
  }

  try {
    const result = await zaloService.sendTextMessage(user_id, message);
    return res.json({ success: true, ...result });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;

