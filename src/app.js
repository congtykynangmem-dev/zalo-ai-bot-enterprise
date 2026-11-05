const express = require('express');
const cors = require('cors');
const path = require('path');
const env = require('./config/env');
const { apiLimiter } = require('./middlewares/rateLimiter');

// Import routes
const webhookRoutes = require('./routes/webhookRoutes');
const authRoutes = require('./routes/authRoutes');
const cskhRoutes = require('./routes/cskhRoutes');
const crmRoutes = require('./routes/crmRoutes');
const knowledgeRoutes = require('./routes/knowledgeRoutes');
const webhookConfigRoutes = require('./routes/webhookConfigRoutes');

const app = express();

// 1. Enable CORS
app.use(cors({ origin: '*', credentials: true }));

// 2. Parse JSON & preserve raw body for Zalo MAC verification
app.use(
  express.json({
    limit: '20mb',
    verify: (req, res, buf) => {
      req.rawBody = buf.toString('utf8');
    }
  })
);
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// 3. Serve frontend static assets
app.use(express.static(path.join(__dirname, '../public')));

// 4. Mount Webhook routes (no api rate limit so Zalo events are fast)
app.use('/', webhookRoutes);

// 5. Mount API routes with rate limiter
app.use('/api', apiLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/cskh', cskhRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/webhook-config', webhookConfigRoutes);

// Direct alias for requirement 3.2: /upload-knowledge
app.post('/upload-knowledge', (req, res, next) => {
  req.url = '/upload';
  knowledgeRoutes(req, res, next);
});

// 6. Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    node_env: env.NODE_ENV,
    version: '2.0.0'
  });
});

// 7. Global SPA route fallback (Express 5 compatible)
app.use((req, res, next) => {
  if (req.method !== 'GET') {
    return next();
  }
  if (req.path.startsWith('/api') || req.path === '/webhook') {
    return res.status(404).json({ error: 'Endpoint không tồn tại' });
  }
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 8. Global Error Handler
app.use((err, req, res, next) => {
  console.error('💥 [Global Error Handler]:', err);

  if (err.name === 'MulterError') {
    return res.status(400).json({ error: `Lỗi tải tệp: ${err.message}` });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Lỗi máy chủ nội bộ',
    ...(env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

module.exports = app;

