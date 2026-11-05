/**
 * Smart Text Chunker for RAG
 * Breaks text into overlapping chunks respecting sentence/paragraph boundaries
 */

function cleanText(text) {
  if (!text) return '';
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Split text into chunks with overlap
 * @param {string} rawText 
 * @param {number} chunkSize Maximum characters per chunk
 * @param {number} chunkOverlap Overlap characters between chunks
 * @returns {Array<{ chunkIndex: number, content: string }>}
 */
function chunkText(rawText, chunkSize = 700, chunkOverlap = 150) {
  const text = cleanText(rawText);
  if (!text) return [];

  if (text.length <= chunkSize) {
    return [{ chunkIndex: 0, content: text }];
  }

  const chunks = [];
  let startIndex = 0;
  let chunkIndex = 0;

  while (startIndex < text.length) {
    let endIndex = startIndex + chunkSize;

    if (endIndex >= text.length) {
      const remainingChunk = text.slice(startIndex).trim();
      if (remainingChunk.length > 20) {
        chunks.push({
          chunkIndex: chunkIndex++,
          content: remainingChunk
        });
      }
      break;
    }

    // Attempt to break at natural boundary: paragraph break, sentence end, or comma/space
    const slice = text.slice(startIndex, endIndex);
    let splitOffset = -1;

    // 1. Try paragraph break
    const lastParagraph = slice.lastIndexOf('\n\n');
    if (lastParagraph > chunkSize * 0.4) {
      splitOffset = lastParagraph + 2;
    } else {
      // 2. Try sentence end (. ! ? followed by space or newline)
      const sentenceMatch = slice.match(/([.!?][\s\n])[^.!?]*$/);
      if (sentenceMatch && sentenceMatch.index > chunkSize * 0.4) {
        splitOffset = sentenceMatch.index + 2;
      } else {
        // 3. Try comma or semicolon
        const clauseMatch = slice.match(/([,;][\s])[^,;]*$/);
        if (clauseMatch && clauseMatch.index > chunkSize * 0.5) {
          splitOffset = clauseMatch.index + 2;
        } else {
          // 4. Try space
          const lastSpace = slice.lastIndexOf(' ');
          if (lastSpace > chunkSize * 0.5) {
            splitOffset = lastSpace + 1;
          } else {
            // Hard cut
            splitOffset = chunkSize;
          }
        }
      }
    }

    const chunkContent = text.slice(startIndex, startIndex + splitOffset).trim();
    if (chunkContent.length > 20) {
      chunks.push({
        chunkIndex: chunkIndex++,
        content: chunkContent
      });
    }

    // Slide window forward with overlap
    startIndex += Math.max(1, splitOffset - chunkOverlap);
  }

  return chunks;
}

module.exports = {
  cleanText,
  chunkText
};

