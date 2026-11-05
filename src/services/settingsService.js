const db = require('../config/db');
const env = require('../config/env');

class SettingsService {
  constructor() {
    this.cache = new Map();
    this.initialized = false;
  }

  /**
   * Initialize settings from DB, falling back to .env
   */
  async init() {
    // Populate defaults from env
    this.cache.set('ZALO_BOT_TOKEN', env.ZALO_BOT_TOKEN || '');
    this.cache.set('ZALO_APP_SECRET', env.ZALO_APP_SECRET || '');
    this.cache.set('VERIFY_MAC', 'true');
    this.cache.set('CUSTOM_WEBHOOK_URL', '');

    try {
      const res = await db.query('SELECT key, value FROM settings');
      for (const row of res.rows) {
        this.cache.set(row.key, row.value);
      }
      this.initialized = true;
    } catch {
      // Table might not exist yet, defaults used
    }
  }

  /**
   * Get a setting by key
   */
  get(key, defaultValue = '') {
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }
    return defaultValue;
  }

  /**
   * Set a setting in cache and database
   */
  async set(key, value) {
    this.cache.set(key, value);
    try {
      const text = `
        INSERT INTO settings (key, value, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (key) DO UPDATE 
        SET value = EXCLUDED.value, updated_at = NOW();
      `;
      await db.query(text, [key, value]);
    } catch (err) {
      console.warn(`⚠️ [SettingsService] Could not persist setting "${key}" to DB:`, err.message);
    }
  }

  /**
   * Get public configuration summary for dashboard (tokens masked)
   */
  getWebhookConfig(req) {
    const rawToken = this.get('ZALO_BOT_TOKEN');
    const rawSecret = this.get('ZALO_APP_SECRET');
    const verifyMac = this.get('VERIFY_MAC') === 'true';

    // Auto-detect current public URL from request host
    let detectedUrl = '';
    if (req) {
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      detectedUrl = `${protocol}://${host}/webhook`;
    }

    const customUrl = this.get('CUSTOM_WEBHOOK_URL');
    const webhookUrl = customUrl || detectedUrl || `${env.APP_URL}/webhook`;

    return {
      webhookUrl,
      botTokenMasked: rawToken ? `${rawToken.slice(0, 6)}...${rawToken.slice(-4)}` : 'Chưa cấu hình',
      appSecretMasked: rawSecret ? `${rawSecret.slice(0, 4)}...${rawSecret.slice(-4)}` : 'Chưa cấu hình',
      hasBotToken: Boolean(rawToken),
      hasAppSecret: Boolean(rawSecret),
      verifyMac,
      apiBaseUrl: env.ZALO_API_BASE_URL
    };
  }

  /**
   * Save updated webhook credentials
   */
  async updateWebhookConfig({ botToken, appSecret, verifyMac, customWebhookUrl }) {
    if (botToken !== undefined && !botToken.includes('...')) {
      await this.set('ZALO_BOT_TOKEN', botToken.trim());
      env.ZALO_BOT_TOKEN = botToken.trim();
    }

    if (appSecret !== undefined && !appSecret.includes('...')) {
      await this.set('ZALO_APP_SECRET', appSecret.trim());
      env.ZALO_APP_SECRET = appSecret.trim();
    }

    if (verifyMac !== undefined) {
      const strVal = verifyMac === true || verifyMac === 'true' ? 'true' : 'false';
      await this.set('VERIFY_MAC', strVal);
    }

    if (customWebhookUrl !== undefined) {
      await this.set('CUSTOM_WEBHOOK_URL', customWebhookUrl.trim());
    }

    return true;
  }
}

const settingsService = new SettingsService();
settingsService.init().catch(() => {});

module.exports = settingsService;

