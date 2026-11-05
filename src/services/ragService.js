const fs = require('fs');
const env = require('../config/env');
const { parseDocument } = require('../utils/documentParser');
const { chunkText } = require('../utils/textChunker');
const geminiService = require('./geminiService');
const knowledgeModel = require('../models/knowledgeModel');

class RAGService {
  /**
   * Process uploaded document: Parse -> Chunk -> Embed -> Save to PostgreSQL
   */
  async indexDocument({ filePath, originalName, title, fileSize, adminId }) {
    console.log(`📄 [RAGService] Indexing document: ${originalName} (${title})`);

    try {
      // 1. Extract plain text from document
      const rawText = await parseDocument(filePath, originalName);
      if (!rawText || rawText.trim().length === 0) {
        throw new Error('Không thể trích xuất nội dung văn bản từ tệp này.');
      }

      // 2. Chunk text
      const rawChunks = chunkText(rawText, env.RAG_CHUNK_SIZE, env.RAG_CHUNK_OVERLAP);
      console.log(`✂️ [RAGService] Created ${rawChunks.length} chunks for ${originalName}`);

      if (rawChunks.length === 0) {
        throw new Error('Nội dung văn bản quá ngắn hoặc rỗng.');
      }

      // 3. Create document record in database
      const docRecord = await knowledgeModel.createDoc({
        title: title || originalName,
        fileName: originalName,
        fileType: originalName.split('.').pop() || 'unknown',
        fileSize: fileSize || 0,
        totalChunks: rawChunks.length,
        createdBy: adminId || null
      });

      // 4. Generate embeddings for all chunks in controlled batches
      const chunksWithEmbeddings = [];
      const batchSize = 5; // To prevent rate limit on embedding API

      for (let i = 0; i < rawChunks.length; i += batchSize) {
        const batch = rawChunks.slice(i, i + batchSize);
        const batchPromises = batch.map(async (chunk) => {
          const embedding = await geminiService.getEmbedding(chunk.content);
          return {
            docId: docRecord.id,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            embedding: embedding,
            metadata: {
              source: originalName,
              title: title,
              length: chunk.content.length
            }
          };
        });

        const batchResults = await Promise.all(batchPromises);
        chunksWithEmbeddings.push(...batchResults);
      }

      // 5. Save chunks into pgvector
      await knowledgeModel.insertChunks(chunksWithEmbeddings);
      console.log(`✅ [RAGService] Successfully stored ${chunksWithEmbeddings.length} chunks in pgvector!`);

      return {
        success: true,
        doc: docRecord,
        totalChunks: chunksWithEmbeddings.length
      };
    } finally {
      // Clean up uploaded temporary file
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (e) {
        console.warn('⚠️ Could not remove temp file:', e.message);
      }
    }
  }

  /**
   * Search most relevant chunks for user query
   * @param {string} queryText 
   * @param {number} topK 
   * @param {number} minSimilarity 
   * @returns {Promise<Array<any>>}
   */
  async searchRelevantChunks(
    queryText,
    topK = env.RAG_TOP_K,
    minSimilarity = env.RAG_SIMILARITY_THRESHOLD
  ) {
    if (!queryText || !queryText.trim()) return [];

    try {
      // 1. Get embedding for the user's question
      const queryEmbedding = await geminiService.getEmbedding(queryText);

      // 2. Perform Cosine Similarity Search in pgvector
      const results = await knowledgeModel.searchSimilarChunks(
        queryEmbedding,
        topK,
        minSimilarity
      );

      console.log(`🔍 [RAGService] Query: "${queryText.slice(0, 50)}..." -> Found ${results.length} chunks (threshold ${minSimilarity})`);
      return results;
    } catch (error) {
      console.error('❌ [RAGService] Search error:', error.message);
      return [];
    }
  }
}

module.exports = new RAGService();

