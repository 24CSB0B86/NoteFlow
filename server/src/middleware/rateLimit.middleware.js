'use strict';
/**
 * rateLimit.middleware.js
 * Tiered rate limiters for different endpoint categories.
 */
const rateLimit = require('express-rate-limit');

/** General API: 100 requests per 15 min per IP */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

/** Auth endpoints (login/signup): 15 attempts per 15 min per IP */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please wait before trying again.' },
});

/** Chat endpoints: 30 messages per 15 min per IP */
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Chat rate limit reached. Please wait a moment before sending more messages.' },
});

/** File upload: 20 uploads per hour per IP */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Upload limit reached. Please wait before uploading more files.' },
});

module.exports = { generalLimiter, authLimiter, chatLimiter, uploadLimiter };
