const ragService = require('../services/ragService');
const knowledgeModel = require('../models/knowledgeModel');

class KnowledgeController {
  /**
   * POST /api/knowledge/upload
   * Upload and index knowledge document (PDF, DOCX, TXT, MD)
   */
  async uploadDocument(req, res) {
    if (!req.file) {
      return res.status(400).json({ error: 'Vui lòng chọn tệp tài liệu để tải lên.' });
    }

    const { title } = req.body;
    const filePath = req.file.path;
    const originalName = req.file.originalname;
    const fileSize = req.file.size;
    const adminId = req.user?.id || null;

    try {
      const result = await ragService.indexDocument({
        filePath,
        originalName,
        title: title || originalName,
        fileSize,
        adminId
      });

      return res.status(201).json({
        success: true,
        message: 'Tài liệu đã được phân tách và nạp vào pgvector thành công!',
        doc: result.doc,
        totalChunks: result.totalChunks
      });
    } catch (error) {
      console.error('❌ Error indexing document:', error);
      return res.status(500).json({
        error: error.message || 'Lỗi khi xử lý và nạp tài liệu vào kho tri thức.'
      });
    }
  }

  /**
   * GET /api/knowledge/docs
   * List all indexed documents
   */
  async listDocuments(req, res) {
    try {
      const docs = await knowledgeModel.listDocs();
      const totalChunks = await knowledgeModel.getTotalChunksCount();

      return res.json({
        success: true,
        totalDocs: docs.length,
        totalChunks,
        docs
      });
    } catch (error) {
      console.error('❌ Error listing knowledge docs:', error);
      return res.status(500).json({ error: 'Lỗi tải danh mục tài liệu.' });
    }
  }

  /**
   * GET /api/knowledge/docs/:id
   * Get document detail and its chunks
   */
  async getDocumentDetails(req, res) {
    const { id } = req.params;

    try {
      const doc = await knowledgeModel.getDocById(id);
      if (!doc) {
        return res.status(404).json({ error: 'Không tìm thấy tài liệu.' });
      }

      return res.json({ success: true, doc });
    } catch (error) {
      return res.status(500).json({ error: 'Lỗi tải chi tiết tài liệu.' });
    }
  }

  /**
   * DELETE /api/knowledge/docs/:id
   * Delete document and all associated chunks
   */
  async deleteDocument(req, res) {
    const { id } = req.params;

    try {
      const deleted = await knowledgeModel.deleteDoc(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Không tìm thấy tài liệu để xóa.' });
      }

      return res.json({
        success: true,
        message: 'Đã xóa tài liệu và các đoạn vector tương ứng.',
        deleted
      });
    } catch (error) {
      console.error('❌ Error deleting document:', error);
      return res.status(500).json({ error: 'Lỗi khi xóa tài liệu.' });
    }
  }

  /**
   * POST /api/knowledge/test-search
   * Test RAG retrieval with a query
   */
  async testSearch(req, res) {
    const { query, topK, minSimilarity } = req.body;

    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập câu hỏi để tìm kiếm.' });
    }

    try {
      const chunks = await ragService.searchRelevantChunks(
        query.trim(),
        topK ? parseInt(topK, 10) : undefined,
        minSimilarity ? parseFloat(minSimilarity) : undefined
      );

      return res.json({
        success: true,
        query: query.trim(),
        totalMatches: chunks.length,
        chunks
      });
    } catch (error) {
      console.error('❌ Error testing RAG search:', error);
      return res.status(500).json({ error: 'Lỗi kiểm tra truy vấn RAG.' });
    }
  }
}

module.exports = new KnowledgeController();

