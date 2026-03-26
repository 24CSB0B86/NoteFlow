import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { requireProfessor } from '../middleware/rbac.js'
import { requireClassroomMember } from '../middleware/classroom.js'
import {
  getSyllabusTree,
  addNode,
  updateNode,
  deleteNode,
  getGapAnalysis,
} from '../controllers/syllabus.controller.js'

const router = Router()

// All syllabus routes require authentication
router.use(authenticate)

// GET /api/syllabus/:classroomId — member access
router.get('/:classroomId', requireClassroomMember, getSyllabusTree)

// GET /api/syllabus/:classroomId/gap-analysis — member access
router.get('/:classroomId/gap-analysis', requireClassroomMember, getGapAnalysis)

// POST /api/syllabus/:classroomId/nodes — professor only
router.post('/:classroomId/nodes', requireClassroomMember, requireProfessor, addNode)

// PUT /api/syllabus/nodes/:nodeId — professor only
router.put('/nodes/:nodeId', requireProfessor, updateNode)

// DELETE /api/syllabus/nodes/:nodeId — professor only
router.delete('/nodes/:nodeId', requireProfessor, deleteNode)

export default router
