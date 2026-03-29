'use strict';
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const c = require('../controllers/bounty.controller');

router.use(authenticate);

router.post('/',                    c.createBounty);
router.get('/my-bounties',          c.getMyBounties);
router.get('/:classroomId',         c.getBounties);
router.post('/:id/claim',           c.claimBounty);
router.post('/:id/submit',          c.submitBounty);
router.post('/:id/approve',         c.approveBounty);
router.post('/:id/reject',          c.rejectBounty);
router.delete('/:id',               c.cancelBounty);

module.exports = router;
