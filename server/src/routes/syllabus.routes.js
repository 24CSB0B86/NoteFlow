const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const { requireProfessor } = require('../middleware/role.middleware');
const {
  getSyllabus, createOrUpdateSyllabus, addNode, updateNode, deleteNode, getGapAnalysis
} = require('../controllers/syllabus.controller');

router.get('/:classroomId', authenticate, getSyllabus);
router.post('/:classroomId', authenticate, requireProfessor, createOrUpdateSyllabus);
router.post('/:classroomId/nodes', authenticate, requireProfessor, addNode);
router.put('/nodes/:nodeId', authenticate, requireProfessor, updateNode);
router.delete('/nodes/:nodeId', authenticate, requireProfessor, deleteNode);
router.get('/:classroomId/gap-analysis', authenticate, getGapAnalysis);

module.exports = router;
