const axios = require('axios');
const env = require('../config/env');
const settingsService = require('./settingsService');

class ZaloService {
  constructor() {
    this.baseUrl = env.ZALO_API_BASE_URL;
  }

  get token() {
    let raw = settingsService.get('ZALO_BOT_TOKEN') || env.ZALO_BOT_TOKEN || '';
    if (!raw) return '';
    raw = raw.trim();
    // Handle ${TOKEN} wrap
    if (raw.startsWith('${') && raw.endsWith('}')) {
      raw = raw.slice(2, -1).trim();
    }
    // Handle accidental 'bot' prefix in token: e.g. bot12345:abc
    if (raw.startsWith('bot') && raw.length > 10 && raw.includes(':')) {
      raw = raw.slice(3).trim();
    }
    return raw;
  }

  /**
   * Helper to get full endpoint URL
   * Format: https://bot-api.zaloplatforms.com/bot<TOKEN>/<action>
   */
  getEndpoint(action) {
    const base = (this.baseUrl || 'https://bot-api.zaloplatforms.com').replace(/\/+$/, '');
    return `${base}/bot${this.token}/${action}`;
  }

  /**
   * Get Bot information from Zalo Bot Platform (getMe)
   */
  async getMe() {
    if (!this.token) {
      throw new Error('Chưa cấu hình ZALO_BOT_TOKEN');
    }
    const url = this.getEndpoint('getMe');
    const res = await axios.get(url, { timeout: 10000 });
    return res.data;
  }

  /**
   * Get current Webhook information (getWebhookInfo)
   */
  async getWebhookInfo() {
    if (!this.token) {
      throw new Error('Chưa cấu hình ZALO_BOT_TOKEN');
    }
    const url = this.getEndpoint('getWebhookInfo');
    const res = await axios.get(url, { timeout: 10000 });
    return res.data;
  }

  /**
   * Register Webhook URL with Zalo Bot Platform (setWebhook)
   * @param {string} webhookUrl
   * @param {string} [secretToken]
   */
  async setWebhook(webhookUrl, secretToken = '') {
    if (!this.token) {
      throw new Error('Chưa cấu hình ZALO_BOT_TOKEN');
    }
    if (!webhookUrl) {
      throw new Error('Thiếu webhookUrl');
    }
    const url = this.getEndpoint('setWebhook');
    const payload = { url: webhookUrl };
    if (secretToken) {
      payload.secret_token = secretToken;
    }
    const res = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000
    });
    return res.data;
  }

  /**
   * Delete Webhook registration from Zalo Bot Platform (deleteWebhook)
   */
  async deleteWebhook() {
    if (!this.token) {
      throw new Error('Chưa cấu hình ZALO_BOT_TOKEN');
    }
    const url = this.getEndpoint('deleteWebhook');
    const res = await axios.post(url, {}, { timeout: 10000 });
    return res.data;
  }

  /**
   * Test connection with Zalo Bot Platform
   */
  async testConnection() {
    if (!this.token) {
      return {
        success: false,
        message: 'Chưa cấu hình ZALO_BOT_TOKEN. Vui lòng nhập token trước khi kiểm tra!'
      };
    }

    try {
      const data = await this.getMe();
      const botName = data?.result?.display_name || data?.result?.account_name || 'Zalo Bot';
      return {
        success: true,
        message: `Kết nối Zalo Bot Platform thành công! (${botName})`,
        data: data
      };
    } catch (err) {
      // Fallback test getUpdates
      try {
        const updateUrl = this.getEndpoint('getUpdates');
        const updateRes = await axios.post(updateUrl, { limit: 1 }, { timeout: 10000 });
        return {
          success: true,
          message: 'Kết nối Zalo Bot Platform thành công (qua getUpdates)!',
          data: updateRes.data
        };
      } catch (subErr) {
        return {
          success: false,
          message: `Không thể kết nối đến Zalo Bot API: ${subErr.response?.data?.description || subErr.message || err.message}`
        };
      }
    }
  }

  /**
   * Send a text message to a Zalo User ID
   * @param {string} zaloUserId
   * @param {string} text
   * @returns {Promise<any>}
   */
  async sendTextMessage(zaloUserId, text) {
    if (!zaloUserId || !text) {
      throw new Error('Missing zaloUserId or text message');
    }

    if (!this.token) {
      console.warn('⚠️ ZALO_BOT_TOKEN is not configured! Mocking sendTextMessage output:');
      console.log(`[Zalo Mock Send] To: ${zaloUserId} | Message: ${text}`);
      return { success: true, mocked: true };
    }

    const url = this.getEndpoint('sendMessage');
    const payload = {
      chat_id: zaloUserId,
      text: text
    };

    try {
      const response = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
      });

      console.log(`✅ [ZaloService] Sent message to ${zaloUserId}`);
      return { success: true, data: response.data };
    } catch (error) {
      const errorData = error.response?.data;
      console.error('❌ [ZaloService] Error sending message to Zalo:', {
        status: error.response?.status,
        data: errorData,
        userId: zaloUserId
      });
      throw new Error(errorData?.description || error.message || 'Failed to send Zalo message');
    }
  }

  /**
   * Send an image with optional caption
   * @param {string} zaloUserId
   * @param {string} imageUrl
   * @param {string} caption
   */
  async sendImageMessage(zaloUserId, imageUrl, caption = '') {
    if (!this.token) {
      console.log(`[Zalo Mock Send Image] To: ${zaloUserId} | Url: ${imageUrl} | Caption: ${caption}`);
      return { success: true, mocked: true };
    }

    const url = this.getEndpoint('sendPhoto');
    const payload = {
      chat_id: zaloUserId,
      photo: imageUrl,
      caption: caption
    };

    try {
      const response = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 20000
      });
      return { success: true, data: response.data };
    } catch (error) {
      console.error('❌ [ZaloService] Send photo failed:', error.response?.data || error.message);
      // Fallback to sending text with link
      return this.sendTextMessage(zaloUserId, `${caption ? caption + '\n' : ''}${imageUrl}`);
    }
  }

  /**
   * Download image/file buffer from URL (for Zalo media attachments)
   * @param {string} fileUrl
   */
  async downloadMedia(fileUrl) {
    try {
      const response = await axios.get(fileUrl, {
        responseType: 'arraybuffer',
        timeout: 20000
      });
      const contentType = response.headers['content-type'] || 'image/jpeg';
      return {
        buffer: Buffer.from(response.data),
        mimeType: contentType
      };
    } catch (error) {
      console.error('❌ [ZaloService] Error downloading media:', error.message);
      throw error;
    }
  }
}

module.exports = new ZaloService();

