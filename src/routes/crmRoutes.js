const express = require('express');
const router = express.Router();
const crmController = require('../controllers/crmController');
const { authenticateJWT } = require('../middlewares/auth');

router.use(authenticateJWT);

router.get('/users', (req, res) => crmController.getUsers(req, res));
router.get('/users/:id', (req, res) => crmController.getUserDetails(req, res));
router.put('/users/:id/tags', (req, res) => crmController.updateTags(req, res));
router.put('/users/:id/notes', (req, res) => crmController.updateNotes(req, res));
router.get('/stats', (req, res) => crmController.getStats(req, res));

module.exports = router;

