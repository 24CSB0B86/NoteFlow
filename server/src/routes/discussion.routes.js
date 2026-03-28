'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const {
  createDiscussion,
  getDiscussions,
  updateDiscussion,
  deleteDiscussion,
  voteDiscussion,
  resolveDiscussion,
  pinDiscussion,
} = require('../controllers/discussion.controller');

const router = Router();
router.use(authenticate);

router.post('/', createDiscussion);
router.get('/:resourceId', getDiscussions);
router.put('/:id', updateDiscussion);
router.delete('/:id', deleteDiscussion);
router.post('/:id/vote', voteDiscussion);
router.post('/:id/resolve', resolveDiscussion);
router.post('/:id/pin', pinDiscussion);

module.exports = router;
