'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const { createHighlight, getHighlights, deleteHighlight } = require('../controllers/highlight.controller');
const { getHeatmap } = require('../services/heatmapService');

const router = Router();
router.use(authenticate);

// Highlights
router.post('/', createHighlight);
router.get('/:resourceId', getHighlights);
router.delete('/:id', deleteHighlight);

// Heatmap (nested here for convenience)
router.get('/heatmap/:resourceId/:pageNumber', getHeatmap);

module.exports = router;
