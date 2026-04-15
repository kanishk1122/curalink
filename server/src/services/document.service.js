const fs = require('fs');
const pdf = require('pdf-parse');
const Tesseract = require('tesseract.js');
const path = require('path');

/**
 * Service to handle extraction of medical data from uploaded documents.
 * Supports PDF (text-extract) and Image (OCR).
 */
class DocumentService {
  /**
   * Main entry point for processing a document.
   */
  async processDocument(filePath, mimetype) {
    try {
      let text = '';
      
      if (mimetype === 'application/pdf') {
        text = await this._processPDF(filePath);
      } else if (mimetype.startsWith('image/')) {
        text = await this._processImage(filePath);
      } else {
        throw new Error('Unsupported file type');
      }

      // Cleanup: Remove temporary file after processing
      // In a real production app, you might want to move this to a cleanup job
      this._deleteFile(filePath);

      return this._structureMedicalText(text);
    } catch (error) {
      console.error('Document Processing Error:', error.message);
      throw error;
    }
  }

  /**
   * Extracts text from PDF files.
   */
  async _processPDF(filePath) {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    return data.text;
  }

  /**
   * Extracts text from images using OCR.
   */
  async _processImage(filePath) {
    const { data: { text } } = await Tesseract.recognize(
      filePath,
      'eng'
    );
    return text;
  }

  /**
   * Helper to delete temporary files.
   */
  _deleteFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
       console.error('Failed to cleanup file:', filePath);
    }
  }

  /**
   * Uses basic heuristics to clean up and structure the medical text.
   * This provides a 'Cleaner' context for the AI.
   */
  _structureMedicalText(rawText) {
    // Remove excessive whitespace
    let clean = rawText.replace(/\s+/g, ' ').trim();
    
    // Attempt to identify suspected lab values (basic regex for patterns like "Value: 12.5 mg/dL")
    // This is just a helper; the real reasoning happens in AIService.
    return {
      raw: clean,
      type: 'Medical Lab Report',
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new DocumentService();
