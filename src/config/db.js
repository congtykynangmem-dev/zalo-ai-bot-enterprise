const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const env = require('./env');

const isCloudDb =
  env.DB_SSL ||
  (env.DATABASE_URL &&
    (env.DATABASE_URL.includes('sslmode=require') ||
      env.DATABASE_URL.includes('neon.tech') ||
      env.DATABASE_URL.includes('supabase.co') ||
      env.DATABASE_URL.includes('aivencloud.com')));

const poolConfig = env.DATABASE_URL
  ? {
      connectionString: env.DATABASE_URL,
      ssl: isCloudDb ? { rejectUnauthorized: false } : false,
      max: env.DB_MAX_CONNECTIONS
    }
  : {
      host: env.DB_HOST,
      port: env.DB_PORT,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME,
      ssl: isCloudDb ? { rejectUnauthorized: false } : false,
      max: env.DB_MAX_CONNECTIONS
    };

const pool = new Pool(poolConfig);

// Pool connection events
pool.on('connect', (client) => {
  // Optional: Set statement timeout or custom session vars
});

pool.on('error', (err) => {
  console.error('❌ Unexpected PostgreSQL Pool Error:', err);
});

/**
 * Execute a single query
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.DEBUG_SQL === 'true') {
      console.log('SQL:', { text: text.slice(0, 80), duration, rows: res.rowCount });
    }
    return res;
  } catch (err) {
    console.error('❌ Database Query Error:', { text: text.slice(0, 100), message: err.message });
    throw err;
  }
}

/**
 * Helper to get a client from the pool for transactions
 */
async function getClient() {
  const client = await pool.connect();
  const query = client.query.bind(client);
  const release = client.release.bind(client);

  const timeout = setTimeout(() => {
    console.error('⚠️ A database client has been checked out for more than 10 seconds!');
  }, 10000);

  client.release = () => {
    clearTimeout(timeout);
    return release();
  };

  return client;
}

/**
 * Auto-initialize database schema (tables, extensions, seed) if not already created
 */
async function autoInitDatabaseSchema() {
  try {
    // Check if 'admins' table exists
    const checkRes = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'admins'
      );
    `);

    const tableExists = checkRes.rows[0]?.exists;
    if (!tableExists) {
      console.log('📦 [Auto-Migration] Table "admins" does not exist. Auto-executing schema.sql...');
      const schemaPath = path.join(__dirname, '../../scripts/schema.sql');
      if (fs.existsSync(schemaPath)) {
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await pool.query(schemaSql);
        console.log('✅ [Auto-Migration] Database schema created successfully!');

        // Seed default admin and cskh accounts
        const salt = await bcrypt.genSalt(10);
        const adminPassHash = await bcrypt.hash('Admin@123456', salt);
        const cskhPassHash = await bcrypt.hash('Cskh@123456', salt);

        await pool.query(
          `INSERT INTO admins (username, password_hash, full_name, role, is_active)
           VALUES ($1, $2, $3, $4, TRUE)
           ON CONFLICT (username) DO NOTHING;`,
          ['admin', adminPassHash, 'System Administrator', 'admin']
        );

        await pool.query(
          `INSERT INTO admins (username, password_hash, full_name, role, is_active)
           VALUES ($1, $2, $3, $4, TRUE)
           ON CONFLICT (username) DO NOTHING;`,
          ['cskh', cskhPassHash, 'Chuyên Viên Hỗ Trợ 01', 'cskh']
        );

        console.log('✅ [Auto-Migration] Default admin & cskh accounts seeded automatically!');
      }
    } else {
      console.log('✅ [Auto-Migration] Database tables verified (admins table exists).');
    }
  } catch (err) {
    console.error('⚠️ [Auto-Migration] Note during auto-migration:', err.message);
  }
}

/**
 * Verify database connectivity and pgvector extension
 */
async function checkDatabaseConnection() {
  try {
    const res = await pool.query('SELECT NOW() as now, version()');
    console.log('✅ PostgreSQL connected successfully at:', res.rows[0].now);

    const vectorRes = await pool.query(
      "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector'"
    );
    if (vectorRes.rows.length > 0) {
      console.log(`✅ pgvector extension active (v${vectorRes.rows[0].extversion})`);
    } else {
      console.warn('⚠️ pgvector extension is NOT installed in this database! Run "CREATE EXTENSION vector;"');
    }

    // Auto-run schema initialization if needed
    await autoInitDatabaseSchema();

    return true;
  } catch (err) {
    console.error('❌ Could not connect to PostgreSQL:', err.message);
    return false;
  }
}

module.exports = {
  pool,
  query,
  getClient,
  checkDatabaseConnection,
  autoInitDatabaseSchema
};

