const db = require('../config/db');

class MessageModel {
  /**
   * Save a new message
   */
  async createMessage({
    userId,
    zaloUserId,
    senderType,
    messageType = 'text',
    content,
    mediaUrl = null,
    rawPayload = {}
  }) {
    const text = `
      INSERT INTO messages (
        user_id,
        zalo_user_id,
        sender_type,
        message_type,
        content,
        media_url,
        raw_payload
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const params = [
      userId,
      zaloUserId,
      senderType,
      messageType,
      content,
      mediaUrl,
      JSON.stringify(rawPayload)
    ];
    const res = await db.query(text, params);
    return res.rows[0];
  }

  /**
   * Get recent messages for session memory (ordered chronologically)
   */
  async getRecentMessages(userId, limit = 10) {
    const text = `
      SELECT * FROM (
        SELECT id, sender_type, message_type, content, media_url, created_at
        FROM messages
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      ) sub
      ORDER BY created_at ASC;
    `;
    const res = await db.query(text, [userId, limit]);
    return res.rows;
  }

  /**
   * Get full conversation history for dashboard with pagination
   */
  async getMessagesByUserId(userId, limit = 100, offset = 0) {
    const text = `
      SELECT id, user_id, zalo_user_id, sender_type, message_type, content, media_url, created_at
      FROM messages
      WHERE user_id = $1
      ORDER BY created_at ASC
      LIMIT $2 OFFSET $3;
    `;
    const res = await db.query(text, [userId, limit, offset]);
    return res.rows;
  }

  /**
   * Get count of messages sent today
   */
  async getTodayMessageCount() {
    const text = `
      SELECT COUNT(*) as count 
      FROM messages 
      WHERE created_at >= CURRENT_DATE;
    `;
    const res = await db.query(text);
    return parseInt(res.rows[0].count, 10);
  }
}

module.exports = new MessageModel();

