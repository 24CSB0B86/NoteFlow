'use strict';
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const c = require('../controllers/analytics.controller');

router.use(authenticate);

router.post('/batch',              c.batchVerify);
router.get('/queue/:classroomId',  c.getVerificationQueue);
router.post('/:resourceId/reject', c.rejectVerification);
router.post('/:resourceId',        c.verifyResource);

module.exports = router;
