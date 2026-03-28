const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireProfessor } = require('../middleware/role.middleware');
const {
  createClassroom, joinClassroom, getMyClassrooms,
  getClassroom, getMembers, deleteClassroom
} = require('../controllers/classroom.controller');

router.get('/my-classes', authenticate, getMyClassrooms);
router.post('/', authenticate, requireProfessor, createClassroom);
router.post('/join', authenticate, joinClassroom);
router.get('/:id', authenticate, getClassroom);
router.get('/:id/members', authenticate, getMembers);
router.delete('/:id', authenticate, requireProfessor, deleteClassroom);

module.exports = router;
