const express = require('express');
const router = express.Router();
const cskhController = require('../controllers/cskhController');
const { authenticateJWT } = require('../middlewares/auth');

// All CSKH routes require authentication (both Admin and CSKH roles can access)
router.use(authenticateJWT);

router.get('/conversations', (req, res) => cskhController.getConversations(req, res));
router.get('/conversations/:userId/messages', (req, res) =>
  cskhController.getConversationHistory(req, res)
);
router.post('/send-message', (req, res) => cskhController.sendCSKHMessage(req, res));
router.post('/toggle-human-mode', (req, res) => cskhController.toggleHumanMode(req, res));

module.exports = router;

