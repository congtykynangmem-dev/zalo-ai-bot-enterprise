const crypto = require('crypto');
const env = require('../config/env');
const settingsService = require('../services/settingsService');

/**
 * Middleware to validate MAC / HMAC-SHA256 signature from Zalo Webhook requests
 */
function verifyZaloMAC(req, res, next) {
  // Check if MAC verification is turned off in settings
  const isVerifyEnabled = settingsService.get('VERIFY_MAC', 'true') === 'true';
  if (!isVerifyEnabled) {
    console.log('ℹ️ [ZaloSecurity] MAC Verification is disabled in Webhook Settings. Skipping.');
    return next();
  }

  const appSecret = settingsService.get('ZALO_APP_SECRET') || env.ZALO_APP_SECRET;

  // If app secret is not configured yet, permit with warning
  if (!appSecret) {
    console.warn('⚠️ [ZaloSecurity] ZALO_APP_SECRET is not configured. Permitting request without signature.');
    return next();
  }

  // 1. Try extracting signature from standard headers
  const signatureHeader =
    req.headers['x-zevent-signature'] ||
    req.headers['x-hub-signature-256'] ||
    req.headers['x-zalo-signature'] ||
    req.headers['mac'];

  // 2. Also check body for 'mac' or 'signature' field if header is absent
  const bodyMac = req.body?.mac || req.body?.signature;

  const incomingSignature = (signatureHeader || bodyMac || '').replace(/^sha256=/i, '').trim();

  if (!incomingSignature) {
    console.warn('❌ [ZaloSecurity] Missing Zalo webhook signature (MAC).');
    return res.status(401).json({ error: 'Unauthorized: Missing webhook MAC signature' });
  }

  try {
    // Standard Zalo HMAC signature calculation
    // Typically sha256(rawBody, appSecret) or sha256(JSON.stringify(req.body), appSecret)
    const rawData = req.rawBody ? req.rawBody : JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', appSecret)
      .update(rawData)
      .digest('hex');

    // Timing-safe comparison to prevent side-channel timing attacks
    const incomingBuffer = Buffer.from(incomingSignature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

    if (
      incomingBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(incomingBuffer, expectedBuffer)
    ) {
      // Signature matches!
      return next();
    }

    // Alternative Zalo format check: sha256(appId + data + timestamp + appSecret)
    if (req.body?.timestamp && req.body?.data) {
      const altData = `${req.body.app_id || ''}${JSON.stringify(req.body.data)}${req.body.timestamp}${appSecret}`;
      const altSignature = crypto.createHash('sha256').update(altData).digest('hex');
      const altBuffer = Buffer.from(altSignature, 'utf8');

      if (
        incomingBuffer.length === altBuffer.length &&
        crypto.timingSafeEqual(incomingBuffer, altBuffer)
      ) {
        return next();
      }
    }

    console.error('❌ [ZaloSecurity] MAC Signature Mismatch!', {
      received: incomingSignature.slice(0, 16) + '...',
      expected: expectedSignature.slice(0, 16) + '...'
    });

    return res.status(401).json({ error: 'Unauthorized: Invalid Zalo MAC signature' });
  } catch (error) {
    console.error('❌ [ZaloSecurity] Error verifying MAC:', error.message);
    return res.status(401).json({ error: 'Unauthorized: Error during MAC verification' });
  }
}

module.exports = {
  verifyZaloMAC
};

