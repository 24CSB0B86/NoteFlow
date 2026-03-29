'use strict';
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const c = require('../controllers/karma.controller');

router.use(authenticate);

router.get('/notifications',             c.getNotifications);
router.post('/notifications/read',       c.markNotificationsRead);
router.get('/badges',                    c.getAllBadges);
router.get('/leaderboard/:classroomId',  c.getLeaderboard);
router.get('/activity/:userId',          c.getActivityLog);
router.get('/:userId',                   c.getUserKarma);

module.exports = router;
