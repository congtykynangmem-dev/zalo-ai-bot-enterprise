const axios = require('axios');
const env = require('../config/env');
const settingsService = require('./settingsService');

class ZaloService {
  constructor() {
    this.baseUrl = env.ZALO_API_BASE_URL;
  }

  get token() {
    return settingsService.get('ZALO_BOT_TOKEN') || env.ZALO_BOT_TOKEN || '';
  }

  /**
   * Helper to get full endpoint URL
   */
  getEndpoint(action) {
    return `${this.baseUrl}/bot${this.token}/${action}`;
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
      // Test getMe or getUpdates
      const url = this.getEndpoint('getMe');
      const res = await axios.get(url, { timeout: 10000 });
      return {
        success: true,
        message: 'Kết nối Zalo Bot Platform thành công!',
        data: res.data
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

