const userModel = require('../models/userModel');
const messageModel = require('../models/messageModel');
const knowledgeModel = require('../models/knowledgeModel');
const socketService = require('../services/socketService');

class CRMController {
  /**
   * GET /api/crm/users
   * List customers with filters and pagination
   */
  async getUsers(req, res) {
    const { search = '', tag = '', isHumanMode = null, page = 1, limit = 50 } = req.query;

    try {
      const data = await userModel.getAllUsers({
        search,
        tag,
        isHumanMode,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
      });
      return res.json({ success: true, ...data });
    } catch (error) {
      console.error('❌ CRM getUsers error:', error);
      return res.status(500).json({ error: 'Lỗi tải danh sách khách hàng.' });
    }
  }

  /**
   * GET /api/crm/users/:id
   * Get customer details
   */
  async getUserDetails(req, res) {
    const { id } = req.params;

    try {
      const user = await userModel.getUserById(id);
      if (!user) {
        return res.status(404).json({ error: 'Không tìm thấy khách hàng.' });
      }

      const recentMessages = await messageModel.getRecentMessages(id, 20);

      return res.json({
        success: true,
        user,
        recentMessages
      });
    } catch (error) {
      return res.status(500).json({ error: 'Lỗi tải thông tin chi tiết.' });
    }
  }

  /**
   * PUT /api/crm/users/:id/tags
   * Update CRM customer tags
   */
  async updateTags(req, res) {
    const { id } = req.params;
    const { tags } = req.body;

    if (!Array.isArray(tags)) {
      return res.status(400).json({ error: 'tags phải là một mảng chuỗi.' });
    }

    try {
      const updatedUser = await userModel.updateTags(id, tags);
      socketService.emitUserUpdate(updatedUser);
      return res.json({ success: true, user: updatedUser });
    } catch (error) {
      console.error('❌ Update tags error:', error);
      return res.status(500).json({ error: 'Lỗi cập nhật thẻ khách hàng.' });
    }
  }

  /**
   * PUT /api/crm/users/:id/notes
   * Update internal CRM notes
   */
  async updateNotes(req, res) {
    const { id } = req.params;
    const { notes } = req.body;

    try {
      const updatedUser = await userModel.updateNotes(id, notes || '');
      socketService.emitUserUpdate(updatedUser);
      return res.json({ success: true, user: updatedUser });
    } catch (error) {
      console.error('❌ Update notes error:', error);
      return res.status(500).json({ error: 'Lỗi cập nhật ghi chú.' });
    }
  }

  /**
   * GET /api/crm/stats
   * Overall dashboard metrics
   */
  async getStats(req, res) {
    try {
      const userStats = await userModel.getStats();
      const todayMessages = await messageModel.getTodayMessageCount();
      const totalChunks = await knowledgeModel.getTotalChunksCount();

      return res.json({
        success: true,
        stats: {
          totalUsers: parseInt(userStats.total_users || 0, 10),
          activeToday: parseInt(userStats.active_today || 0, 10),
          humanModeUsers: parseInt(userStats.human_mode_users || 0, 10),
          todayMessages,
          totalKnowledgeChunks: totalChunks
        }
      });
    } catch (error) {
      console.error('❌ Get stats error:', error);
      return res.status(500).json({ error: 'Lỗi tải số liệu thống kê.' });
    }
  }
}

module.exports = new CRMController();

