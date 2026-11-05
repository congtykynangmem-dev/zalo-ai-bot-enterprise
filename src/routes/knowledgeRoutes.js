const express = require('express');
const router = express.Router();
const knowledgeController = require('../controllers/knowledgeController');
const { authenticateJWT, requireRole } = require('../middlewares/auth');
const { uploadLimiter } = require('../middlewares/rateLimiter');
const upload = require('../middlewares/upload');

router.use(authenticateJWT);

// Upload document (Admin only)
router.post(
  '/upload',
  requireRole(['admin']),
  uploadLimiter,
  upload.single('file'),
  (req, res) => knowledgeController.uploadDocument(req, res)
);

// List all documents
router.get('/docs', (req, res) => knowledgeController.listDocuments(req, res));

// Get document details & chunks
router.get('/docs/:id', (req, res) => knowledgeController.getDocumentDetails(req, res));

// Delete document (Admin only)
router.delete('/docs/:id', requireRole(['admin']), (req, res) =>
  knowledgeController.deleteDocument(req, res)
);

// Test RAG Retrieval simulator
router.post('/test-search', (req, res) => knowledgeController.testSearch(req, res));

module.exports = router;

