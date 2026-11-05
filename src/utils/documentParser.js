const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

/**
 * Extract plain text from supported document formats
 * @param {string} filePath Absolute or relative path to file
 * @param {string} originalName Original file name with extension
 * @returns {Promise<string>} Extracted plain text
 */
async function parseDocument(filePath, originalName = '') {
  const ext = (path.extname(originalName || filePath) || '').toLowerCase();
  const fileBuffer = fs.readFileSync(filePath);

  switch (ext) {
    case '.txt':
    case '.md':
    case '.csv':
    case '.json': {
      return fileBuffer.toString('utf8');
    }

    case '.pdf': {
      const pdfData = await pdfParse(fileBuffer);
      return pdfData.text || '';
    }

    case '.docx': {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      return result.value || '';
    }

    default:
      // Fallback try reading as text
      try {
        return fileBuffer.toString('utf8');
      } catch {
        throw new Error(`Định dạng tệp ${ext} không được hỗ trợ. Vui lòng tải lên PDF, DOCX, TXT hoặc MD.`);
      }
  }
}

module.exports = {
  parseDocument
};

