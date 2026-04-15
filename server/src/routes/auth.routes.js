const express = require('express');
const router = express.Router();
const { register, login, logout, claimChats, getProfile, googleLogin } = require('../controllers/auth.controller');
const { protect } = require('../middlewares/auth.middleware');

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);
router.post('/claim', protect, claimChats);
router.post('/logout', logout);
router.get('/me', protect, getProfile);

module.exports = router;
