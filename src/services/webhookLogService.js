const db = require('../config/db');
const socketService = require('./socketService');

class WebhookLogService {
  constructor() {
    this.memoryLogs = [];
    this.maxMemoryLogs = 50;
  }

  /**
   * Record an incoming webhook event
   */
  async logEvent({ eventType, senderId, status = 'success', errorMessage = null, payload = {} }) {
    const logEntry = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      event_type: eventType || 'unknown_event',
      sender_id: senderId || 'N/A',
      status: status,
      error_message: errorMessage,
      payload: payload,
      created_at: new Date().toISOString()
    };

    // 1. Store in in-memory ring buffer for immediate dashboard display
    this.memoryLogs.unshift(logEntry);
    if (this.memoryLogs.length > this.maxMemoryLogs) {
      this.memoryLogs.pop();
    }

    // 2. Persist to database if available
    try {
      const text = `
        INSERT INTO webhook_logs (event_type, sender_id, status, error_message, payload)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, created_at;
      `;
      const res = await db.query(text, [
        logEntry.event_type,
        logEntry.sender_id,
        logEntry.status,
        logEntry.error_message,
        JSON.stringify(payload)
      ]);
      if (res.rows[0]) {
        logEntry.id = res.rows[0].id;
        logEntry.created_at = res.rows[0].created_at;
      }
    } catch {
      // Memory fallback is active
    }

    // 3. Emit real-time notification to Admin Dashboard via Socket.IO
    if (socketService.io) {
      socketService.io.to('admin_room').emit('webhook_event_received', logEntry);
    }

    return logEntry;
  }

  /**
   * Get recent webhook logs
   */
  async getRecentLogs(limit = 20) {
    try {
      const text = `
        SELECT id, event_type, sender_id, status, error_message, payload, created_at
        FROM webhook_logs
        ORDER BY created_at DESC
        LIMIT $1;
      `;
      const res = await db.query(text, [limit]);
      if (res.rows.length > 0) {
        return res.rows;
      }
    } catch {
      // Fallback to memory logs
    }
    return this.memoryLogs.slice(0, limit);
  }

  /**
   * Clear logs
   */
  async clearLogs() {
    this.memoryLogs = [];
    try {
      await db.query('TRUNCATE TABLE webhook_logs;');
    } catch {}
    return true;
  }
}

module.exports = new WebhookLogService();

