require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

async function seed() {
  console.log('🌱 Starting Database Seeding & Schema Setup...');

  const connectionString = process.env.DATABASE_URL;
  const pool = new Pool(
    connectionString
      ? { connectionString }
      : {
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432', 10),
          user: process.env.DB_USER || 'postgres',
          password: process.env.DB_PASSWORD || 'postgres',
          database: process.env.DB_NAME || 'zalo_ai_crm',
          ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
        }
  );

  try {
    const client = await pool.connect();
    console.log('✅ Connected to PostgreSQL successfully.');

    // 1. Read schema.sql
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('📦 Executing schema.sql (tables, indexes, pgvector)...');
    await client.query(schemaSql);
    console.log('✅ Schema created successfully.');

    // 2. Hash passwords with bcrypt
    const salt = await bcrypt.genSalt(10);
    const adminPassHash = await bcrypt.hash('Admin@123456', salt);
    const cskhPassHash = await bcrypt.hash('Cskh@123456', salt);

    // 3. Upsert admin account
    await client.query(
      `INSERT INTO admins (username, password_hash, full_name, role, is_active)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (username) DO UPDATE 
       SET password_hash = EXCLUDED.password_hash,
           full_name = EXCLUDED.full_name,
           updated_at = NOW()`,
      ['admin', adminPassHash, 'System Administrator', 'admin', true]
    );
    console.log('👤 Admin account ready: username = "admin", password = "Admin@123456"');

    // 4. Upsert cskh account
    await client.query(
      `INSERT INTO admins (username, password_hash, full_name, role, is_active)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (username) DO UPDATE 
       SET password_hash = EXCLUDED.password_hash,
           full_name = EXCLUDED.full_name,
           updated_at = NOW()`,
      ['cskh', cskhPassHash, 'Chuyên Viên Hỗ Trợ 01', 'cskh', true]
    );
    console.log('🎧 CSKH account ready: username = "cskh", password = "Cskh@123456"');

    client.release();
    console.log('🎉 Database seeding completed successfully!');
  } catch (err) {
    console.error('❌ Error during database seeding:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();

