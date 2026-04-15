const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { optional } = require('../middlewares/auth.middleware');

router.get('/', optional, chatController.listChats);
router.get('/context', optional, chatController.getRecentContext);
router.get('/:id', optional, chatController.getChatHistory);
router.post('/message', optional, chatController.sendMessage);

module.exports = router;
