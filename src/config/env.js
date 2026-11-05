require('dotenv').config();

// Safe port parsing for cPanel / Phusion Passenger / Mắt Bão Hosting
const rawPort = process.env.PORT;
const parsedPort = rawPort ? (isNaN(Number(rawPort)) ? rawPort : Number(rawPort)) : 3000;

const env = {
  PORT: parsedPort,
  NODE_ENV: process.env.NODE_ENV || 'production',
  APP_URL: process.env.APP_URL || (typeof parsedPort === 'number' ? `http://localhost:${parsedPort}` : 'http://localhost'),

  // Zalo Bot Platform
  ZALO_BOT_TOKEN: process.env.ZALO_BOT_TOKEN || '',
  ZALO_APP_SECRET: process.env.ZALO_APP_SECRET || '',
  ZALO_API_BASE_URL: process.env.ZALO_API_BASE_URL || 'https://bot-api.zaloplatforms.com',

  // Google Gemini AI
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_TEXT_MODEL: process.env.GEMINI_TEXT_MODEL || 'gemini-1.5-flash',
  GEMINI_EMBEDDING_MODEL: process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004',

  // PostgreSQL Database
  DATABASE_URL: process.env.DATABASE_URL || process.env.EXTERNAL_DB_URL || process.env.PG_URL || '',
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT || '5432', 10),
  DB_USER: process.env.DB_USER || 'postgres',
  DB_PASSWORD: process.env.DB_PASSWORD || 'postgres',
  DB_NAME: process.env.DB_NAME || 'zalo_ai_crm',
  DB_SSL: process.env.DB_SSL === 'true',
  DB_MAX_CONNECTIONS: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10),

  // JWT Security
  JWT_SECRET: process.env.JWT_SECRET || 'fallback_jwt_secret_please_change_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  // RAG & Knowledge Base
  RAG_CHUNK_SIZE: parseInt(process.env.RAG_CHUNK_SIZE || '700', 10),
  RAG_CHUNK_OVERLAP: parseInt(process.env.RAG_CHUNK_OVERLAP || '150', 10),
  RAG_SIMILARITY_THRESHOLD: parseFloat(process.env.RAG_SIMILARITY_THRESHOLD || '0.65'),
  RAG_TOP_K: parseInt(process.env.RAG_TOP_K || '4', 10),

  // Human Handoff Keywords
  HANDOFF_KEYWORDS: (process.env.HANDOFF_KEYWORDS || 'gặp nhân viên,tư vấn viên,gặp người thật,chăm sóc khách hàng,kết nối cskh,hỗ trợ viên,gặp cskh')
    .split(',')
    .map(k => k.trim().toLowerCase())
    .filter(Boolean)
};

module.exports = env;

