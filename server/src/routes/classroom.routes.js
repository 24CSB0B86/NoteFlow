import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { requireProfessor } from '../middleware/rbac.js'
import {
  requireClassroomMember,
  requireClassroomProfessor,
} from '../middleware/classroom.js'
import {
  createClassroom,
  joinClassroom,
  getMyClassrooms,
  getClassroom,
  deleteClassroom,
  getMembers,
} from '../controllers/classroom.controller.js'

const router = Router()

// All classroom routes require authentication
router.use(authenticate)

// POST /api/classrooms — Professor only
router.post('/', requireProfessor, createClassroom)

// POST /api/classrooms/join — Any authenticated user
router.post('/join', joinClassroom)

// GET /api/classrooms/my — All classrooms for current user
router.get('/my', getMyClassrooms)

// GET /api/classrooms/:id — Members only
router.get('/:id', requireClassroomMember, getClassroom)

// DELETE /api/classrooms/:id — Professor/owner only
router.delete('/:id', requireClassroomMember, requireClassroomProfessor, deleteClassroom)

// GET /api/classrooms/:id/members — Members only
router.get('/:id/members', requireClassroomMember, getMembers)

export default router
