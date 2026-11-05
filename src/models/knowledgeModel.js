const db = require('../config/db');

class KnowledgeModel {
  /**
   * Create document record
   */
  async createDoc({ title, fileName, fileType, fileSize, totalChunks, createdBy }) {
    const text = `
      INSERT INTO knowledge_docs (title, file_name, file_type, file_size, total_chunks, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const res = await db.query(text, [
      title,
      fileName,
      fileType,
      fileSize || 0,
      totalChunks || 0,
      createdBy || null
    ]);
    return res.rows[0];
  }

  /**
   * Batch insert chunks with vector embeddings
   * @param {Array<{ docId: string, chunkIndex: number, content: string, embedding: number[], metadata: object }>} chunks
   */
  async insertChunks(chunks) {
    if (!chunks || chunks.length === 0) return [];

    const client = await db.getClient();
    try {
      await client.query('BEGIN');

      const inserted = [];
      const queryText = `
        INSERT INTO knowledge_chunks (doc_id, chunk_index, content, embedding, metadata)
        VALUES ($1, $2, $3, $4::vector, $5)
        RETURNING id, doc_id, chunk_index, content;
      `;

      for (const chunk of chunks) {
        // Format embedding array to vector string: '[0.123, -0.456, ...]'
        const vectorStr = `[${chunk.embedding.join(',')}]`;
        const res = await client.query(queryText, [
          chunk.docId,
          chunk.chunkIndex,
          chunk.content,
          vectorStr,
          JSON.stringify(chunk.metadata || {})
        ]);
        inserted.push(res.rows[0]);
      }

      await client.query('COMMIT');
      return inserted;
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('❌ Error inserting knowledge chunks transaction:', err);
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Cosine similarity search using pgvector (<=> operator)
   * 1 - (embedding <=> query_vector) represents Cosine Similarity (from 0 to 1)
   * @param {number[]} embeddingVector 768-dim float array
   * @param {number} topK Number of closest chunks to retrieve
   * @param {number} minSimilarity Minimum cosine similarity threshold
   */
  async searchSimilarChunks(embeddingVector, topK = 4, minSimilarity = 0.65) {
    const vectorStr = `[${embeddingVector.join(',')}]`;

    const text = `
      SELECT 
        kc.id,
        kc.doc_id,
        kc.chunk_index,
        kc.content,
        kc.metadata,
        kd.title as doc_title,
        kd.file_name,
        1 - (kc.embedding <=> $1::vector) AS similarity
      FROM knowledge_chunks kc
      JOIN knowledge_docs kd ON kd.id = kc.doc_id
      WHERE 1 - (kc.embedding <=> $1::vector) >= $2
      ORDER BY kc.embedding <=> $1::vector ASC
      LIMIT $3;
    `;

    const res = await db.query(text, [vectorStr, minSimilarity, topK]);
    return res.rows;
  }

  /**
   * List all knowledge documents with chunk count and uploader info
   */
  async listDocs() {
    const text = `
      SELECT 
        kd.*,
        a.full_name as creator_name
      FROM knowledge_docs kd
      LEFT JOIN admins a ON a.id = kd.created_by
      ORDER BY kd.created_at DESC;
    `;
    const res = await db.query(text);
    return res.rows;
  }

  /**
   * Get single document by ID with its chunks
   */
  async getDocById(id) {
    const docQuery = `
      SELECT kd.*, a.full_name as creator_name
      FROM knowledge_docs kd
      LEFT JOIN admins a ON a.id = kd.created_by
      WHERE kd.id = $1;
    `;
    const docRes = await db.query(docQuery, [id]);
    if (docRes.rows.length === 0) return null;

    const chunksQuery = `
      SELECT id, chunk_index, content, metadata, created_at
      FROM knowledge_chunks
      WHERE doc_id = $1
      ORDER BY chunk_index ASC;
    `;
    const chunksRes = await db.query(chunksQuery, [id]);

    return {
      ...docRes.rows[0],
      chunks: chunksRes.rows
    };
  }

  /**
   * Delete document (cascades to chunks via foreign key)
   */
  async deleteDoc(id) {
    const text = 'DELETE FROM knowledge_docs WHERE id = $1 RETURNING *;';
    const res = await db.query(text, [id]);
    return res.rows[0];
  }

  /**
   * Count total knowledge chunks across all documents
   */
  async getTotalChunksCount() {
    const text = 'SELECT COUNT(*) as count FROM knowledge_chunks;';
    const res = await db.query(text);
    return parseInt(res.rows[0].count, 10);
  }
}

module.exports = new KnowledgeModel();

