const userModel = require('../models/userModel');
const messageModel = require('../models/messageModel');
const zaloService = require('../services/zaloService');
const handoffService = require('../services/handoffService');
const socketService = require('../services/socketService');

class CSKHController {
  /**
   * GET /api/cskh/conversations
   * Get active conversation threads for Live Chat
   */
  async getConversations(req, res) {
    const { search = '', isHumanMode = null, page = 1, limit = 50 } = req.query;

    try {
      const result = await userModel.getAllUsers({
        search,
        isHumanMode,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10)
      });

      return res.json({ success: true, ...result });
    } catch (error) {
      console.error('❌ Error fetching conversations:', error);
      return res.status(500).json({ error: 'Lỗi tải danh sách hội thoại.' });
    }
  }

  /**
   * GET /api/cskh/conversations/:userId/messages
   * Get message history for a specific conversation
   */
  async getConversationHistory(req, res) {
    const { userId } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    try {
      const user = await userModel.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: 'Không tìm thấy người dùng này.' });
      }

      const messages = await messageModel.getMessagesByUserId(
        userId,
        parseInt(limit, 10),
        parseInt(offset, 10)
      );

      return res.json({
        success: true,
        user,
        messages
      });
    } catch (error) {
      console.error('❌ Error fetching messages:', error);
      return res.status(500).json({ error: 'Lỗi tải lịch sử tin nhắn.' });
    }
  }

  /**
   * POST /api/cskh/send-message
   * CSKH manual message to customer on Zalo
   */
  async sendCSKHMessage(req, res) {
    const { userId, message } = req.body;

    if (!userId || !message || !message.trim()) {
      return res.status(400).json({ error: 'Vui lòng cung cấp userId và nội dung tin nhắn.' });
    }

    try {
      const user = await userModel.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: 'Không tìm thấy người dùng Zalo.' });
      }

      // If user is not yet in human mode, auto-switch to human mode so AI won't interfere
      let activeUser = user;
      if (!user.is_human_mode) {
        activeUser = await handoffService.activateHumanMode(user, 'Nhân viên CSKH trực tiếp can thiệp trả lời');
      }

      // Send to Zalo
      await zaloService.sendTextMessage(user.zalo_user_id, message.trim());

      // Save to database with sender_type = 'agent'
      const agentMessage = await messageModel.createMessage({
        userId: user.id,
        zaloUserId: user.zalo_user_id,
        senderType: 'agent',
        messageType: 'text',
        content: message.trim(),
        rawPayload: {
          agentId: req.user.id,
          agentName: req.user.full_name
        }
      });

      // Broadcast to live chat
      socketService.emitNewMessage(agentMessage, activeUser);

      return res.json({
        success: true,
        message: agentMessage
      });
    } catch (error) {
      console.error('❌ Error sending CSKH message:', error);
      return res.status(500).json({ error: error.message || 'Lỗi gửi tin nhắn đến Zalo.' });
    }
  }

  /**
   * POST /api/cskh/toggle-human-mode
   * Toggle between AI Mode and Human Agent Mode
   */
  async toggleHumanMode(req, res) {
    const { userId, isHumanMode, notifyUser = true } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Thiếu userId.' });
    }

    try {
      const user = await userModel.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
      }

      let updatedUser;
      if (isHumanMode) {
        updatedUser = await handoffService.activateHumanMode(user, 'Nhân viên kích hoạt can thiệp từ Dashboard');
      } else {
        updatedUser = await handoffService.deactivateHumanMode(user, notifyUser);
      }

      return res.json({
        success: true,
        user: updatedUser
      });
    } catch (error) {
      console.error('❌ Error toggling human mode:', error);
      return res.status(500).json({ error: 'Lỗi chuyển đổi chế độ CSKH / AI.' });
    }
  }
}

module.exports = new CSKHController();

