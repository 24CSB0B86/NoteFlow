'use strict';
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { chatLimiter } = require('../middleware/rateLimit.middleware');
const {
  sendMessage,
  getHistory,
  clearHistory,
  rateMessage,
} = require('../controllers/chat.controller');

// All chat routes require authentication
router.use(authenticate);

// POST   /api/chat           – send a message
router.post('/', chatLimiter, sendMessage);

// GET    /api/chat/history   – fetch chat history (paginated)
router.get('/history', getHistory);

// DELETE /api/chat/history   – clear all chat history for current user
router.delete('/history', clearHistory);

// PATCH  /api/chat/:id/rate  – rate an assistant message (thumbs up/down)
router.patch('/:messageId/rate', rateMessage);

module.exports = router;
