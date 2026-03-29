'use strict';
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const c = require('../controllers/analytics.controller');

router.use(authenticate);

router.delete('/resource/:id',       c.softDeleteResource);
router.post('/user/:id/flag',        c.flagUser);
router.delete('/discussion/:id',     c.deleteDiscussion);
router.get('/logs/:classroomId',     c.getAuditLog);

module.exports = router;
