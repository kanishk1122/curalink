const express = require('express');
const router = express.Router();
const { register, login, logout, claimChats, getProfile, googleLogin } = require('../controllers/auth.controller');
const { protect } = require('../middlewares/auth.middleware');

const { authLimiter } = require('../middlewares/rate-limit.middleware');

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/google', authLimiter, googleLogin);
router.post('/claim', protect, claimChats);
router.post('/logout', logout);
router.get('/me', protect, getProfile);

module.exports = router;
