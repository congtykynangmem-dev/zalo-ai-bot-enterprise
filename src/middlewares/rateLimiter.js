const rateLimit = require('express-rate-limit');

// Limiter for general API endpoints (login, CRM queries)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});

// Limiter for Auth endpoints (login / register)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // 20 attempts per 15 minutes
  message: {
    error: 'Too many login attempts. Please try again after 15 minutes.'
  }
});

// Limiter for Webhook endpoints (High throughput, but prevents burst attacks)
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 600, // 600 webhook events per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Webhook rate limit exceeded.'
  }
});

// Limiter for Knowledge Base file uploads
const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 30, // 30 document uploads per 10 minutes
  message: {
    error: 'Tải lên quá thường xuyên. Vui lòng thử lại sau ít phút.'
  }
});

module.exports = {
  apiLimiter,
  authLimiter,
  webhookLimiter,
  uploadLimiter
};

