const settingsService = require('../services/settingsService');
const zaloService = require('../services/zaloService');
const webhookLogService = require('../services/webhookLogService');
const webhookController = require('./webhookController');

class WebhookConfigController {
  /**
   * GET /api/webhook-config
   * Get current webhook configuration details
   */
  async getConfig(req, res) {
    try {
      const config = settingsService.getWebhookConfig(req);
      const recentLogs = await webhookLogService.getRecentLogs(10);

      return res.json({
        success: true,
        config,
        stats: {
          totalLogsRecorded: recentLogs.length,
          lastActivityAt: recentLogs[0]?.created_at || null
        }
      });
    } catch (err) {
      console.error('❌ Error getting webhook config:', err);
      return res.status(500).json({ error: 'Lỗi tải cấu hình Webhook.' });
    }
  }

  /**
   * PUT /api/webhook-config
   * Save updated webhook configuration
   */
  async updateConfig(req, res) {
    const { botToken, appSecret, verifyMac, customWebhookUrl } = req.body;

    try {
      await settingsService.updateWebhookConfig({
        botToken,
        appSecret,
        verifyMac,
        customWebhookUrl
      });

      const updated = settingsService.getWebhookConfig(req);

      return res.json({
        success: true,
        message: 'Đã lưu cấu hình Webhook thành công!',
        config: updated
      });
    } catch (err) {
      console.error('❌ Error updating webhook config:', err);
      return res.status(500).json({ error: 'Lỗi lưu cấu hình Webhook.' });
    }
  }

  /**
   * POST /api/webhook-config/test-zalo
   * Test connection to Zalo Bot Platform API with current token
   */
  async testConnection(req, res) {
    try {
      const result = await zaloService.testConnection();
      return res.json(result);
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: `Lỗi kiểm tra kết nối Zalo: ${err.message}`
      });
    }
  }

  /**
   * GET /api/webhook-config/zalo-info
   * Fetch current bot and webhook info from Zalo API
   */
  async getZaloInfo(req, res) {
    try {
      const [botRes, webhookRes] = await Promise.allSettled([
        zaloService.getMe(),
        zaloService.getWebhookInfo()
      ]);

      return res.json({
        success: true,
        bot: botRes.status === 'fulfilled' ? botRes.value : null,
        webhook: webhookRes.status === 'fulfilled' ? webhookRes.value : null,
        error: botRes.status === 'rejected' ? botRes.reason?.message : null
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: `Lỗi lấy thông tin Zalo Bot: ${err.message}`
      });
    }
  }

  /**
   * POST /api/webhook-config/set-webhook
   * Set Webhook URL directly via Zalo Bot API
   */
  async setWebhook(req, res) {
    const { webhookUrl, secretToken } = req.body;
    if (!webhookUrl) {
      return res.status(400).json({ error: 'Thiếu webhookUrl' });
    }

    try {
      const result = await zaloService.setWebhook(webhookUrl, secretToken);
      return res.json({
        success: true,
        message: 'Đăng ký Webhook với Zalo Bot Platform thành công!',
        result
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: `Lỗi cấu hình Webhook: ${err.response?.data?.description || err.message}`
      });
    }
  }

  /**
   * GET /api/webhook-config/logs
   * Get recent incoming webhook events log
   */
  async getLogs(req, res) {
    const { limit = 30 } = req.query;
    try {
      const logs = await webhookLogService.getRecentLogs(parseInt(limit, 10));
      return res.json({ success: true, logs });
    } catch (err) {
      return res.status(500).json({ error: 'Lỗi tải nhật ký Webhook.' });
    }
  }

  /**
   * DELETE /api/webhook-config/logs
   * Clear webhook logs
   */
  async clearLogs(req, res) {
    try {
      await webhookLogService.clearLogs();
      return res.json({ success: true, message: 'Đã xóa nhật ký Webhook.' });
    } catch (err) {
      return res.status(500).json({ error: 'Lỗi xóa nhật ký.' });
    }
  }

  /**
   * POST /api/webhook-config/simulate
   * Simulate a Zalo incoming message event for testing without phone
   */
  async simulateEvent(req, res) {
    const { text = 'Xin chào trợ lý AI, cho tôi hỏi về dịch vụ!', senderId = 'test_user_01', senderName = 'Khách Thử Nghiệm' } = req.body;

    const simulatedPayload = {
      update_id: Date.now(),
      message: {
        message_id: Math.floor(Math.random() * 100000),
        from: {
          id: senderId,
          first_name: senderName
        },
        chat: {
          id: senderId,
          type: 'private'
        },
        date: Math.floor(Date.now() / 1000),
        text: text
      }
    };

    // Forward to webhook handler
    const mockReq = { body: simulatedPayload, headers: {} };
    const mockRes = {
      status: () => mockRes,
      json: () => mockRes
    };

    try {
      // Fire in background
      webhookController.handleWebhook(mockReq, mockRes);

      return res.json({
        success: true,
        message: 'Đã gửi sự kiện Webhook thử nghiệm thành công! Hãy kiểm tra tab Live Chat.',
        simulatedPayload
      });
    } catch (err) {
      return res.status(500).json({ error: `Lỗi giả lập sự kiện: ${err.message}` });
    }
  }
}

module.exports = new WebhookConfigController();

