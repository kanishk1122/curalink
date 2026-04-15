const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const docController = require('../controllers/doc.controller');
const { protect } = require('../middlewares/auth.middleware');

// Configure multer for secure temporary storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Ensure the path is relative to the server executable
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only Images (JPG/PNG) and PDFs are allowed'));
  }
});

/**
 * Route: POST /api/docs/upload
 * Description: High-fidelity medical report upload and analysis
 */
router.post('/upload', protect, upload.single('file'), docController.uploadDocument);

module.exports = router;
