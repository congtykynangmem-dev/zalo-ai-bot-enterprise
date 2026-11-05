require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const env = require('./src/config/env');
const { checkDatabaseConnection } = require('./src/config/db');
const socketService = require('./src/services/socketService');

async function startServer() {
  console.log('🚀 Initializing Enterprise Zalo AI Bot Server...');

  // 1. Verify PostgreSQL and pgvector
  await checkDatabaseConnection();

  // 2. Create HTTP Server
  const server = http.createServer(app);

  // 3. Initialize Socket.IO for Live Chat & Real-time Handoff
  socketService.init(server);

  // 4. Listen on configured PORT
  server.listen(env.PORT, () => {
    console.log(`=======================================================`);
    console.log(`✨ ZALO AI BOT ENTERPRISE (RAG & MINI CRM) IS RUNNING ✨`);
    console.log(`📡 Server URL:        http://localhost:${env.PORT}`);
    console.log(`🔗 Webhook Endpoint:  http://localhost:${env.PORT}/webhook`);
    console.log(`📊 Admin Dashboard:   http://localhost:${env.PORT}`);
    console.log(`🤖 AI Engine:         Gemini (${env.GEMINI_TEXT_MODEL})`);
    console.log(`📐 Embedding Model:   Gemini (${env.GEMINI_EMBEDDING_MODEL} - 768 dim)`);
    console.log(`🗄️ Database:          PostgreSQL + pgvector`);
    console.log(`=======================================================`);
  });

  // Handle graceful shutdowns
  const shutdown = async (signal) => {
    console.log(`\n🛑 Received ${signal}. Gracefully shutting down...`);
    server.close(() => {
      console.log('👋 HTTP & WebSocket server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
