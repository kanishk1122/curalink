const documentService = require('../services/document.service');
const path = require('path');

/**
 * Controller for handling medical document uploads and analysis.
 */
const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { path: filePath, mimetype } = req.file;
    
    // Process the document using DocumentService
    const analysis = await documentService.processDocument(filePath, mimetype);

    res.json({
      success: true,
      data: analysis,
      message: 'Medical report analyzed successfully'
    });
  } catch (error) {
    console.error('Document Upload/Analysis Error:', error);
    res.status(500).json({
      error: 'Failed to analyze document',
      details: error.message
    });
  }
};

module.exports = {
  uploadDocument
};
