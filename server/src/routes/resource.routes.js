'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const {
  uploadResource,
  getResources,
  getVersionHistory,
  rollbackVersion,
  deleteResource,
  downloadResource,
  getPreview,
  getJobStatus,
} = require('../controllers/resource.controller');

const router = Router();

// All resource routes require authentication
router.use(authenticate);

router.post('/upload', uploadResource);
router.get('/node/:nodeId', getResources);
router.get('/:id/versions', getVersionHistory);
router.post('/:id/rollback/:versionId', rollbackVersion);
router.delete('/:id', deleteResource);
router.get('/:id/download', downloadResource);
router.get('/:id/preview', getPreview);
router.get('/:id/job-status', getJobStatus);

module.exports = router;
