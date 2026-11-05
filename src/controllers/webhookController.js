const userModel = require('../models/userModel');
const messageModel = require('../models/messageModel');
const zaloService = require('../services/zaloService');
const geminiService = require('../services/geminiService');
const ragService = require('../services/ragService');
const handoffService = require('../services/handoffService');
const socketService = require('../services/socketService');
const webhookLogService = require('../services/webhookLogService');

class WebhookController {
  /**
   * GET /webhook: Verification endpoint for Zalo Webhook subscription
   */
  async verifyWebhook(req, res) {
    const challenge = req.query['hub.challenge'] || req.query['challenge'] || 'OK';
    console.log('📡 [Webhook] Received verification challenge query:', req.query);

    // Log verification event
    webhookLogService.logEvent({
      eventType: 'webhook_verification',
      senderId: 'Zalo Server',
      status: 'success',
      payload: req.query
    });

    return res.status(200).send(challenge);
  }

  /**
   * POST /webhook: Main Real-time Webhook handler
   */
  async handleWebhook(req, res) {
    const payload = req.body;
    console.log('📨 [Webhook] Received incoming payload:', JSON.stringify(payload).slice(0, 300));

    // Acknowledge receipt immediately to Zalo so the request doesn't timeout
    res.status(200).json({ ok: true, received: true });

    try {
      // 1. Extract sender info and message content from diverse Zalo formats
      const extracted = this.extractZaloMessageData(payload);
      if (!extracted || !extracted.zaloUserId) {
        console.log('ℹ️ [Webhook] Non-message event or missing sender ID, skipped.');
        webhookLogService.logEvent({
          eventType: payload.event_name || 'non_message_event',
          senderId: 'N/A',
          status: 'ignored',
          payload
        });
        return;
      }

      const { zaloUserId, displayName, avatarUrl, text, messageType, mediaUrl } = extracted;
      console.log(`👤 [Webhook] Message from ${displayName} (${zaloUserId}): "${text || '[Media]'}"`);

      // Log successful message reception
      webhookLogService.logEvent({
        eventType: `user_send_${messageType}`,
        senderId: zaloUserId,
        status: 'success',
        payload
      });

      // 2. Upsert customer in PostgreSQL (Mini CRM)
      const user = await userModel.upsertUser({
        zaloUserId,
        displayName,
        avatarUrl
      });

      // 3. Save incoming user message to database
      const userMessage = await messageModel.createMessage({
        userId: user.id,
        zaloUserId: user.zalo_user_id,
        senderType: 'user',
        messageType: messageType,
        content: text || (messageType === 'image' ? '[Hình ảnh]' : '[Tập tin]'),
        mediaUrl: mediaUrl,
        rawPayload: payload
      });

      // Emit new message event to dashboard in real-time
      socketService.emitNewMessage(userMessage, user);

      // 4. Check for Human Handoff triggers
      // Scenario A: User is already in human mode
      if (user.is_human_mode) {
        console.log(`🛑 [Webhook] User ${zaloUserId} is currently handled by Human CSKH. Bot will NOT reply.`);
        return;
      }

      // Scenario B: User requests a human agent via keywords
      const wantsHuman = handoffService.detectHandoffIntent(text);
      if (wantsHuman) {
        await handoffService.activateHumanMode(user, 'Khách hàng gõ từ khóa yêu cầu gặp nhân viên');
        return;
      }

      // 5. Fetch recent 5-10 messages for Session Memory (Context)
      const conversationHistory = await messageModel.getRecentMessages(user.id, 8);

      // 6. Process message with AI & RAG
      let botReplyText = '';

      if (messageType === 'image' && mediaUrl) {
        // Multimedia handling: Vision OCR & image explanation
        try {
          const { buffer, mimeType } = await zaloService.downloadMedia(mediaUrl);
          
          // Also retrieve knowledge if there is a caption
          let contextChunks = [];
          if (text) {
            contextChunks = await ragService.searchRelevantChunks(text, 3);
          }

          botReplyText = await geminiService.analyzeImageWithPrompt({
            imageBuffer: buffer,
            mimeType: mimeType,
            prompt: text,
            contextChunks: contextChunks
          });
        } catch (imgErr) {
          console.error('❌ [Webhook] Error processing image:', imgErr.message);
          botReplyText = 'Dạ tôi đã nhận được ảnh của bạn nhưng chưa thể đọc được chi tiết lúc này. Bạn vui lòng gửi thêm câu hỏi dạng chữ để tôi hỗ trợ nhé!';
        }
      } else {
        // Text processing: RAG Retrieval -> Gemini Pro Grounded Response
        // Retrieve top relevant chunks from pgvector
        const contextChunks = await ragService.searchRelevantChunks(text);

        // Generate strictly grounded response
        botReplyText = await geminiService.generateRAGResponse({
          query: text,
          contextChunks: contextChunks,
          conversationHistory: conversationHistory,
          userName: user.display_name || 'Quý khách'
        });
      }

      // 7. Send reply back to Zalo user
      if (botReplyText) {
        await zaloService.sendTextMessage(zaloUserId, botReplyText);

        // Save bot response to database
        const botMessage = await messageModel.createMessage({
          userId: user.id,
          zaloUserId: user.zalo_user_id,
          senderType: 'bot',
          messageType: 'text',
          content: botReplyText
        });

        // Broadcast to Dashboard Live Chat
        socketService.emitNewMessage(botMessage, user);
      }

      // 8. Auto-tag customer asynchronously based on chat content
      this.triggerAutoTagging(user, text);
    } catch (error) {
      console.error('❌ [Webhook] Unhandled error processing event:', error);
    }
  }

  /**
   * Helper to parse diverse Zalo Bot & OA payloads
   */
  extractZaloMessageData(payload) {
    if (!payload) return null;

    // 1. Zalo Bot Platform format (update.message)
    const msg = payload.message || (Array.isArray(payload.updates) && payload.updates[0]?.message);
    if (msg) {
      const from = msg.from || {};
      const chat = msg.chat || {};
      const zaloUserId = (chat.id || from.id || '').toString();
      const displayName =
        [from.first_name, from.last_name].filter(Boolean).join(' ') ||
        chat.title ||
        `Zalo User #${zaloUserId.slice(-4)}`;

      let messageType = 'text';
      let text = msg.text || '';
      let mediaUrl = null;

      // Check for photo attachment
      if (Array.isArray(msg.photo) && msg.photo.length > 0) {
        messageType = 'image';
        // Pick highest resolution photo
        const bestPhoto = msg.photo[msg.photo.length - 1];
        mediaUrl = bestPhoto.url || bestPhoto.file_url || null;
        text = msg.caption || text;
      } else if (msg.document) {
        messageType = 'file';
        mediaUrl = msg.document.file_url || null;
        text = msg.caption || msg.document.file_name || '';
      }

      return {
        zaloUserId,
        displayName,
        avatarUrl: null,
        text,
        messageType,
        mediaUrl
      };
    }

    // 2. Zalo OA Webhook format (event_name, sender, message)
    if (payload.event_name && payload.sender) {
      const zaloUserId = (payload.sender.id || payload.user_id_by_app || '').toString();
      const oaMsg = payload.message || {};
      let messageType = 'text';
      let text = oaMsg.text || '';
      let mediaUrl = null;

      if (oaMsg.attachments && oaMsg.attachments.length > 0) {
        const att = oaMsg.attachments[0];
        if (att.type === 'photo' || att.type === 'image') {
          messageType = 'image';
          mediaUrl = att.payload?.url || null;
          text = att.payload?.description || text;
        } else {
          messageType = 'file';
          mediaUrl = att.payload?.url || null;
        }
      }

      return {
        zaloUserId,
        displayName: payload.sender.name || `Khách hàng ${zaloUserId.slice(-4)}`,
        avatarUrl: payload.sender.avatar || null,
        text,
        messageType,
        mediaUrl
      };
    }

    // 3. Fallback direct format
    if (payload.user_id || payload.chat_id) {
      const zaloUserId = (payload.user_id || payload.chat_id).toString();
      return {
        zaloUserId,
        displayName: payload.name || `Khách #${zaloUserId.slice(-4)}`,
        avatarUrl: null,
        text: payload.text || payload.message || '',
        messageType: 'text',
        mediaUrl: null
      };
    }

    return null;
  }

  /**
   * Run auto-tagging in background without blocking webhook response
   */
  async triggerAutoTagging(user, text) {
    if (!text || text.length < 4) return;
    try {
      const updatedTags = await geminiService.classifyAndAutoTag(text, user.tags || []);
      if (JSON.stringify(updatedTags) !== JSON.stringify(user.tags)) {
        console.log(`🏷️ [Webhook] Updated tags for user ${user.zalo_user_id}:`, updatedTags);
        const savedUser = await userModel.updateTags(user.id, updatedTags);
        socketService.emitUserUpdate(savedUser);
      }
    } catch (err) {
      console.warn('⚠️ Auto-tagging error:', err.message);
    }
  }
}

module.exports = new WebhookController();

