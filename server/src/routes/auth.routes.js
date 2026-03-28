const express = require('express');
const router = express.Router();
const { signup, login, me, logout, resetPassword, verifyEmail } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.post('/signup', signup);
router.post('/login', login);
router.post('/verify-email', verifyEmail);
router.post('/reset-password', resetPassword);
router.get('/me', authenticate, me);
router.post('/logout', authenticate, logout);

module.exports = router;
