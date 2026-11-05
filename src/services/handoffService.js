const env = require('../config/env');
const userModel = require('../models/userModel');
const messageModel = require('../models/messageModel');
const zaloService = require('./zaloService');
const socketService = require('./socketService');

class HandoffService {
  /**
   * Check if a message text contains intent to speak with a human agent
   * @param {string} text 
   * @returns {boolean}
   */
  detectHandoffIntent(text) {
    if (!text) return false;
    const lower = text.toLowerCase().trim();

    // Check exact keyword inclusion
    const matched = env.HANDOFF_KEYWORDS.some((kw) => lower.includes(kw));
    return matched;
  }

  /**
   * Activate human handoff mode for user
   * @param {Object} user 
   * @param {string} reason 
   */
  async activateHumanMode(user, reason = 'Khách hàng yêu cầu gặp tư vấn viên') {
    console.log(`🛎️ [HandoffService] Activating Human Mode for user ${user.zalo_user_id} (${user.display_name})`);

    // 1. Update user in DB
    const updatedUser = await userModel.setHumanMode(user.id, true);

    // 2. Send acknowledgment message to Zalo user
    const ackMessage =
      'Dạ, yêu cầu của bạn đã được chuyển đến chuyên viên tư vấn (CSKH). Nhân viên sẽ kết nối và hỗ trợ bạn ngay trong giây lát ạ!';

    try {
      await zaloService.sendTextMessage(user.zalo_user_id, ackMessage);

      // Save system/bot message to DB
      const botMsg = await messageModel.createMessage({
        userId: user.id,
        zaloUserId: user.zalo_user_id,
        senderType: 'bot',
        messageType: 'text',
        content: ackMessage
      });

      // Emit new message event to dashboard
      socketService.emitNewMessage(botMsg, updatedUser);
    } catch (e) {
      console.error('❌ Error sending handoff ack to Zalo:', e.message);
    }

    // 3. Emit alert to CSKH dashboard
    socketService.emitHandoffAlert(updatedUser, reason);
    socketService.emitUserUpdate(updatedUser);

    return updatedUser;
  }

  /**
   * Deactivate human mode and return control back to AI
   * @param {Object} user 
   * @param {boolean} notifyUser Whether to notify user on Zalo
   */
  async deactivateHumanMode(user, notifyUser = true) {
    console.log(`🤖 [HandoffService] Deactivating Human Mode for user ${user.zalo_user_id}. Returning to AI.`);

    const updatedUser = await userModel.setHumanMode(user.id, false);

    if (notifyUser) {
      const returnMessage =
        'Chuyên viên tư vấn đã hoàn tất phiên hỗ trợ trực tiếp. Trợ lý Zalo AI đã sẵn sàng tiếp tục đồng hành cùng bạn!';
      try {
        await zaloService.sendTextMessage(user.zalo_user_id, returnMessage);

        const botMsg = await messageModel.createMessage({
          userId: user.id,
          zaloUserId: user.zalo_user_id,
          senderType: 'bot',
          messageType: 'text',
          content: returnMessage
        });

        socketService.emitNewMessage(botMsg, updatedUser);
      } catch (e) {
        console.error('❌ Error sending return ack to Zalo:', e.message);
      }
    }

    socketService.emitUserUpdate(updatedUser);
    return updatedUser;
  }
}

module.exports = new HandoffService();

