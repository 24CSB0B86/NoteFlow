'use strict';
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const c = require('../controllers/analytics.controller');

router.use(authenticate);

router.get('/:classroomId/overview',   c.getOverview);
router.get('/:classroomId/resources',  c.getResourceStats);
router.get('/:classroomId/students',   c.getStudentMetrics);
router.get('/:classroomId/topics',     c.getTopicAnalysis);
router.get('/:classroomId/timeline',   c.getTimeline);
router.get('/:classroomId/export',     c.exportCSV);

module.exports = router;
