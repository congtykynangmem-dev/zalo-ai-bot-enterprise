const db = require('../config/db');

class AdminModel {
  /**
   * Find admin/CSKH by username
   */
  async findByUsername(username) {
    const text = 'SELECT * FROM admins WHERE username = $1 AND is_active = TRUE LIMIT 1';
    const res = await db.query(text, [username]);
    return res.rows[0] || null;
  }

  /**
   * Find admin/CSKH by ID
   */
  async findById(id) {
    const text = 'SELECT id, username, full_name, role, is_active, created_at FROM admins WHERE id = $1 LIMIT 1';
    const res = await db.query(text, [id]);
    return res.rows[0] || null;
  }

  /**
   * Create a new staff account (Admin only)
   */
  async createAdmin({ username, passwordHash, fullName, role = 'cskh' }) {
    const text = `
      INSERT INTO admins (username, password_hash, full_name, role, is_active)
      VALUES ($1, $2, $3, $4, TRUE)
      RETURNING id, username, full_name, role, is_active, created_at;
    `;
    const res = await db.query(text, [username, passwordHash, fullName, role]);
    return res.rows[0];
  }

  /**
   * List all staff accounts
   */
  async listAll() {
    const text = `
      SELECT id, username, full_name, role, is_active, created_at, updated_at
      FROM admins
      ORDER BY created_at DESC;
    `;
    const res = await db.query(text);
    return res.rows;
  }
}

module.exports = new AdminModel();

