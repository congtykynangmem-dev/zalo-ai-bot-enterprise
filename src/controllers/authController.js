const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const adminModel = require('../models/adminModel');
const { autoInitDatabaseSchema } = require('../config/db');

class AuthController {
  /**
   * POST /api/auth/login
   */
  async login(req, res) {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Vui lòng nhập tên đăng nhập và mật khẩu.' });
    }

    const cleanUsername = username.trim();

    try {
      let user = null;
      let dbError = null;

      try {
        user = await adminModel.findByUsername(cleanUsername);
      } catch (err) {
        dbError = err;
        console.warn('⚠️ [Login] Database query failed:', err.message);

        // If table doesn't exist, auto-create tables from schema.sql
        if (err.message && (err.message.includes('does not exist') || err.message.includes('relation "admins"'))) {
          console.log('🔄 [Login] Attempting auto-migration for missing tables...');
          await autoInitDatabaseSchema();
          try {
            user = await adminModel.findByUsername(cleanUsername);
            dbError = null;
          } catch (retryErr) {
            dbError = retryErr;
          }
        }
      }

      // 1. If user was found in PostgreSQL, verify bcrypt password
      if (user) {
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
          return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác.' });
        }

        const token = jwt.sign(
          {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            role: user.role
          },
          env.JWT_SECRET,
          { expiresIn: env.JWT_EXPIRES_IN }
        );

        return res.json({
          success: true,
          token,
          user: {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            role: user.role
          }
        });
      }

      // 2. If database is not yet ready or credentials match default accounts
      const isDefaultAdmin = cleanUsername === 'admin' && password === 'Admin@123456';
      const isDefaultCSKH = cleanUsername === 'cskh' && password === 'Cskh@123456';

      if (isDefaultAdmin || isDefaultCSKH) {
        const role = isDefaultAdmin ? 'admin' : 'cskh';
        const fullName = isDefaultAdmin ? 'System Administrator' : 'Chuyên Viên Hỗ Trợ 01';

        const token = jwt.sign(
          {
            id: '00000000-0000-0000-0000-000000000001',
            username: cleanUsername,
            full_name: fullName,
            role: role
          },
          env.JWT_SECRET,
          { expiresIn: env.JWT_EXPIRES_IN }
        );

        return res.json({
          success: true,
          token,
          user: {
            id: '00000000-0000-0000-0000-000000000001',
            username: cleanUsername,
            full_name: fullName,
            role: role
          },
          warning: dbError
            ? 'Đang chạy ở chế độ dự phòng. Vui lòng kiểm tra lại biến DATABASE_URL trên Vibe Host để lưu trữ dữ liệu vĩnh viễn.'
            : null
        });
      }

      // 3. User does not exist and does not match default credentials
      return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác.' });
    } catch (error) {
      console.error('❌ Login error:', error);
      return res.status(500).json({
        error: `Lỗi máy chủ (${error.message || 'Chưa xác định'}). Vui lòng kiểm tra DATABASE_URL!`
      });
    }
  }

  /**
   * GET /api/auth/me
   */
  async getMe(req, res) {
    return res.json({
      success: true,
      user: {
        id: req.user.id,
        username: req.user.username,
        full_name: req.user.full_name,
        role: req.user.role
      }
    });
  }

  /**
   * POST /api/auth/staff (Admin only)
   */
  async createStaff(req, res) {
    const { username, password, fullName, role } = req.body;

    if (!username || !password || !fullName) {
      return res.status(400).json({ error: 'Thiếu thông tin tài khoản nhân viên.' });
    }

    try {
      const existing = await adminModel.findByUsername(username.trim());
      if (existing) {
        return res.status(400).json({ error: 'Tên đăng nhập đã tồn tại trong hệ thống.' });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const staff = await adminModel.createAdmin({
        username: username.trim(),
        passwordHash,
        fullName: fullName.trim(),
        role: role === 'admin' ? 'admin' : 'cskh'
      });

      return res.status(201).json({ success: true, staff });
    } catch (error) {
      console.error('❌ Error creating staff:', error);
      return res.status(500).json({ error: 'Lỗi khi tạo tài khoản nhân viên.' });
    }
  }

  /**
   * GET /api/auth/staff (Admin only)
   */
  async listStaff(req, res) {
    try {
      const staffList = await adminModel.listAll();
      return res.json({ success: true, staff: staffList });
    } catch (error) {
      return res.status(500).json({ error: 'Lỗi lấy danh sách nhân viên.' });
    }
  }
}

module.exports = new AuthController();

