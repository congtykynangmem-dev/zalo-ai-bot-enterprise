const db = require('../config/db');

class UserModel {
  /**
   * Upsert a user upon receiving a Zalo message
   */
  async upsertUser({ zaloUserId, displayName, avatarUrl }) {
    const text = `
      INSERT INTO users (zalo_user_id, display_name, avatar_url, last_interaction_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (zalo_user_id) 
      DO UPDATE SET
        display_name = COALESCE(EXCLUDED.display_name, users.display_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
        last_interaction_at = NOW(),
        updated_at = NOW()
      RETURNING *;
    `;
    const res = await db.query(text, [zaloUserId, displayName || null, avatarUrl || null]);
    return res.rows[0];
  }

  /**
   * Find user by Zalo User ID
   */
  async getUserByZaloId(zaloUserId) {
    const text = 'SELECT * FROM users WHERE zalo_user_id = $1 LIMIT 1';
    const res = await db.query(text, [zaloUserId]);
    return res.rows[0] || null;
  }

  /**
   * Find user by UUID
   */
  async getUserById(id) {
    const text = 'SELECT * FROM users WHERE id = $1 LIMIT 1';
    const res = await db.query(text, [id]);
    return res.rows[0] || null;
  }

  /**
   * Get list of users with search, tags, pagination, and latest message snippet
   */
  async getAllUsers({ search = '', tag = '', isHumanMode = null, page = 1, limit = 50 }) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(u.display_name ILIKE $${params.length} OR u.zalo_user_id ILIKE $${params.length} OR u.phone ILIKE $${params.length})`);
    }

    if (tag) {
      params.push(tag);
      conditions.push(`$${params.length} = ANY(u.tags)`);
    }

    if (isHumanMode !== null && isHumanMode !== undefined && isHumanMode !== '') {
      params.push(isHumanMode === 'true' || isHumanMode === true);
      conditions.push(`u.is_human_mode = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) as total FROM users u ${whereClause}`;
    const countRes = await db.query(countQuery, params);
    const total = parseInt(countRes.rows[0].total, 10);

    const listQuery = `
      SELECT 
        u.*,
        (
          SELECT content FROM messages m 
          WHERE m.user_id = u.id 
          ORDER BY m.created_at DESC 
          LIMIT 1
        ) as last_message_content,
        (
          SELECT sender_type FROM messages m 
          WHERE m.user_id = u.id 
          ORDER BY m.created_at DESC 
          LIMIT 1
        ) as last_message_sender,
        (
          SELECT COUNT(*) FROM messages m 
          WHERE m.user_id = u.id
        ) as total_messages
      FROM users u
      ${whereClause}
      ORDER BY u.last_interaction_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const listRes = await db.query(listQuery, [...params, limit, offset]);

    return {
      total,
      page,
      limit,
      users: listRes.rows
    };
  }

  /**
   * Update CRM tags for a user
   */
  async updateTags(id, tags) {
    const text = `
      UPDATE users 
      SET tags = $2, updated_at = NOW() 
      WHERE id = $1 
      RETURNING *
    `;
    const res = await db.query(text, [id, tags]);
    return res.rows[0];
  }

  /**
   * Update internal CRM notes
   */
  async updateNotes(id, notes) {
    const text = `
      UPDATE users 
      SET notes = $2, updated_at = NOW() 
      WHERE id = $1 
      RETURNING *
    `;
    const res = await db.query(text, [id, notes]);
    return res.rows[0];
  }

  /**
   * Toggle or set human handoff mode
   */
  async setHumanMode(id, isHumanMode) {
    const text = `
      UPDATE users 
      SET 
        is_human_mode = $2,
        handoff_requested_at = CASE WHEN $2 = TRUE THEN NOW() ELSE NULL END,
        updated_at = NOW() 
      WHERE id = $1 
      RETURNING *
    `;
    const res = await db.query(text, [id, isHumanMode]);
    return res.rows[0];
  }

  /**
   * Get overall CRM user statistics
   */
  async getStats() {
    const text = `
      SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE is_human_mode = TRUE) as human_mode_users,
        COUNT(*) FILTER (WHERE last_interaction_at >= NOW() - INTERVAL '24 HOURS') as active_today
      FROM users
    `;
    const res = await db.query(text);
    return res.rows[0];
  }
}

module.exports = new UserModel();

