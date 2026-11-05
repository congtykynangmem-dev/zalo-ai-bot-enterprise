const { GoogleGenerativeAI } = require('@google/generative-ai');
const env = require('../config/env');

class GeminiService {
  constructor() {
    this.apiKey = env.GEMINI_API_KEY;
    if (this.apiKey) {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
    } else {
      console.warn('⚠️ GEMINI_API_KEY is not configured! Gemini features will run in mock mode.');
      this.genAI = null;
    }
  }

  /**
   * Generate text embedding using text-embedding-004 (768 dimensions)
   * @param {string} text 
   * @returns {Promise<number[]>} Vector of floats
   */
  async getEmbedding(text) {
    if (!this.genAI) {
      console.warn('⚠️ Gemini API Key not set. Generating mock 768-dim embedding.');
      return new Array(768).fill(0).map(() => (Math.random() - 0.5) * 0.1);
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: env.GEMINI_EMBEDDING_MODEL });
      const result = await model.embedContent(text.slice(0, 8000));
      return result.embedding.values;
    } catch (error) {
      console.error('❌ [GeminiService] Error generating embedding:', error.message);
      throw error;
    }
  }

  /**
   * Generate response using RAG context and Conversation History
   * @param {Object} params
   * @param {string} params.query Current user question
   * @param {Array<Object>} params.contextChunks Retrieved RAG chunks
   * @param {Array<Object>} params.conversationHistory Recent user & bot messages
   * @param {string} params.userName Optional user name
   * @returns {Promise<string>}
   */
  async generateRAGResponse({ query, contextChunks = [], conversationHistory = [], userName = 'Quý khách' }) {
    if (!this.genAI) {
      return `[Mock AI Response] Xin chào ${userName}! Tôi là Trợ lý Zalo AI. (Vui lòng cấu hình GEMINI_API_KEY trong file .env để kích hoạt AI)`;
    }

    try {
      // Build knowledge context block
      let contextText = '';
      if (contextChunks && contextChunks.length > 0) {
        contextText = contextChunks
          .map((c, i) => `[TÀI LIỆU ${i + 1}]:\n${c.content}`)
          .join('\n\n---\n\n');
      } else {
        contextText = 'KHÔNG CÓ TÀI LIỆU NỘI BỘ NÀO TRÙNG KHỚP VỚI CÂU HỎI.';
      }

      const systemInstruction = `Bạn là Trợ Lý AI Doanh Nghiệp thông minh, tận tâm và chuyên nghiệp hỗ trợ khách hàng qua Zalo.
Khách hàng đang trao đổi với bạn có tên là: "${userName}".

QUY TẮC CỐT LÕI (GROUNDING RULE - BẮT BUỘC TUÂN THỦ):
1. Bạn CHỈ ĐƯỢC PHÉP trả lời dựa trên thông tin có trong mục [KHO TRI THỨC NỘI BỘ] bên dưới.
2. TUYỆT ĐỐI KHÔNG tự suy đoán, bịa đặt (hallucinate) hoặc thêm thắt thông tin nằm ngoài tài liệu.
3. Nếu câu hỏi của khách hàng KHÔNG CÓ hoặc KHÔNG ĐỦ thông tin trong [KHO TRI THỨC NỘI BỘ], hãy lịch sự thông báo rằng hiện tại bạn chưa có thông tin chính thức về vấn đề này trong tài liệu, và gợi ý khách hàng: "Quý khách có thể nhắn 'gặp nhân viên' để được chuyên viên tư vấn hỗ trợ trực tiếp ngay nhé!"
4. Trình bày câu trả lời ngắn gọn, rõ ràng, gãy gọn, chia mục bằng bullet points khi phù hợp với giao diện chat trên điện thoại. Luôn giữ thái độ thân thiện, lịch sự và hỗ trợ.

[KHO TRI THỨC NỘI BỘ]:
${contextText}
`;

      const model = this.genAI.getGenerativeModel({
        model: env.GEMINI_TEXT_MODEL,
        systemInstruction: systemInstruction,
        generationConfig: {
          temperature: 0.2, // Low temperature for factual grounded answers
          maxOutputTokens: 1000
        }
      });

      // Prepare conversation history turns for Gemini
      const contents = [];
      for (const msg of conversationHistory) {
        if (msg.sender_type === 'user') {
          contents.push({ role: 'user', parts: [{ text: msg.content }] });
        } else if (msg.sender_type === 'bot' || msg.sender_type === 'agent') {
          contents.push({ role: 'model', parts: [{ text: msg.content }] });
        }
      }

      // Add current user prompt
      contents.push({ role: 'user', parts: [{ text: query }] });

      const chatResponse = await model.generateContent({ contents });
      return chatResponse.response.text();
    } catch (error) {
      console.error('❌ [GeminiService] Error generating RAG response:', error.message);
      return 'Dạ xin lỗi quý khách, hệ thống AI đang gặp chút gián đoạn tạm thời. Quý khách vui lòng thử lại sau ít phút hoặc nhắn "gặp nhân viên" để được hỗ trợ nhé!';
    }
  }

  /**
   * Analyze Image using Gemini Vision with optional context
   * @param {Object} params
   * @param {Buffer} params.imageBuffer
   * @param {string} params.mimeType
   * @param {string} params.prompt
   * @param {Array<Object>} params.contextChunks
   */
  async analyzeImageWithPrompt({ imageBuffer, mimeType = 'image/jpeg', prompt = '', contextChunks = [] }) {
    if (!this.genAI) {
      return '[Mock Vision] Đã nhận được hình ảnh của bạn! (Cấu hình GEMINI_API_KEY để kích hoạt Vision OCR).';
    }

    try {
      let contextText = '';
      if (contextChunks && contextChunks.length > 0) {
        contextText = `\n\n[TÀI LIỆU THAM KHẢO]:\n` + contextChunks.map(c => c.content).join('\n---\n');
      }

      const model = this.genAI.getGenerativeModel({ model: env.GEMINI_TEXT_MODEL });
      const imagePart = {
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType: mimeType
        }
      };

      const finalPrompt = `Bạn là trợ lý Zalo AI đọc ảnh và tài liệu thông minh.
Nhiệm vụ: Hãy quan sát kỹ bức ảnh này, trích xuất nội dung văn bản (OCR) hoặc mô tả chi tiết nội dung trong ảnh. Sau đó giải đáp yêu cầu của khách hàng: "${prompt || 'Hãy đọc và giải thích nội dung bức ảnh này'}".
${contextText}
Hãy trả lời ngắn gọn, rõ ràng và lịch sự.`;

      const result = await model.generateContent([finalPrompt, imagePart]);
      return result.response.text();
    } catch (error) {
      console.error('❌ [GeminiService] Vision analysis error:', error.message);
      return 'Dạ tôi đã nhận được ảnh của bạn, nhưng chưa thể đọc rõ chi tiết. Bạn có thể chụp lại góc sáng hơn hoặc gửi thêm câu hỏi cụ thể nhé!';
    }
  }

  /**
   * Automatically classify customer message into CRM tags
   * @param {string} messageText 
   * @param {string[]} existingTags 
   * @returns {Promise<string[]>}
   */
  async classifyAndAutoTag(messageText, existingTags = []) {
    if (!this.genAI || !messageText) return existingTags;

    try {
      const taxonomy = [
        'Hỏi giá',
        'Tư vấn sản phẩm',
        'Kỹ thuật',
        'Hành chính',
        'Khiếu nại',
        'Khách VIP',
        'Khách tiềm năng',
        'Chính sách'
      ];

      const prompt = `Phân loại tin nhắn của khách hàng Zalo vào tối đa 2 thẻ (tags) phù hợp nhất từ danh mục sau:
${taxonomy.join(', ')}

Tin nhắn: "${messageText}"

Chỉ trả về danh sách thẻ cách nhau bởi dấu phẩy, không thêm bất kỳ văn bản giải thích nào khác. Nếu không khớp thẻ nào, trả lời "Khác".`;

      const model = this.genAI.getGenerativeModel({ model: env.GEMINI_TEXT_MODEL });
      const result = await model.generateContent(prompt);
      const rawTags = result.response.text().trim();

      const newTags = rawTags
        .split(',')
        .map(t => t.trim())
        .filter(t => taxonomy.includes(t));

      // Combine and deduplicate
      const combined = Array.from(new Set([...(existingTags || []), ...newTags]));
      return combined;
    } catch (error) {
      console.warn('⚠️ [GeminiService] Auto-tagging error (skipped):', error.message);
      return existingTags;
    }
  }
}

module.exports = new GeminiService();

