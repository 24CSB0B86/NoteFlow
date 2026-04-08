'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const {
  getSections,
  getSectionResources,
  uploadExamResource,
  downloadExamResource,
  approveExamResource,
  rejectExamResource,
  getTests,
  createTest,
  generateTestWithAI,
  getTest,
  submitTest,
  getTestLeaderboard,
} = require('../controllers/exam.controller');

const router = Router();
router.use(authenticate);

// Exam Sections
router.get('/:classroomId/sections', getSections);

// Exam Resources
router.get('/section/:sectionId/resources', getSectionResources);
router.post('/section/:sectionId/upload', uploadExamResource);
router.get('/resource/:resourceId/download', downloadExamResource);
router.post('/resource/:resourceId/approve', approveExamResource);
router.post('/resource/:resourceId/reject', rejectExamResource);

// Revision Tests
router.get('/section/:sectionId/tests', getTests);
router.post('/section/:sectionId/tests', createTest);
router.post('/section/:sectionId/tests/generate', generateTestWithAI);
router.get('/test/:testId', getTest);
router.post('/test/:testId/submit', submitTest);
router.get('/test/:testId/leaderboard', getTestLeaderboard);

module.exports = router;
