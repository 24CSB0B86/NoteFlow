import { ClassroomModel } from '../models/classroom.model.js'

/**
 * POST /api/classrooms
 * Professor only — create a new classroom
 */
export const createClassroom = async (req, res) => {
  const { name, section, description } = req.body
  if (!name?.trim()) {
    return res.status(400).json({ error: 'Classroom name is required' })
  }
  const classroom = await ClassroomModel.create({
    name: name.trim(),
    section: section?.trim(),
    description: description?.trim(),
    professorId: req.user.id,
  })
  res.status(201).json({ classroom })
}

/**
 * POST /api/classrooms/join
 * Any authenticated user — join via invite code
 */
export const joinClassroom = async (req, res) => {
  const { invite_code } = req.body
  if (!invite_code) {
    return res.status(400).json({ error: 'invite_code is required' })
  }
  const classroom = await ClassroomModel.findByInviteCode(invite_code)
  if (!classroom) {
    return res.status(404).json({ error: 'Invalid invite code — classroom not found' })
  }
  const member = await ClassroomModel.addMember(classroom.id, req.user.id)
  if (!member) {
    // Already a member — return classroom silently
    return res.json({ classroom, message: 'Already a member of this classroom' })
  }
  res.json({ classroom, message: 'Successfully joined classroom' })
}

/**
 * GET /api/classrooms/my
 * Get all classrooms for the authenticated user
 */
export const getMyClassrooms = async (req, res) => {
  const classrooms = await ClassroomModel.findByUser(req.user.id)
  res.json({ classrooms })
}

/**
 * GET /api/classrooms/:id
 * Get a single classroom (membership required via middleware)
 */
export const getClassroom = async (req, res) => {
  const classroom = await ClassroomModel.findById(req.params.id)
  if (!classroom) {
    return res.status(404).json({ error: 'Classroom not found' })
  }
  res.json({ classroom })
}

/**
 * DELETE /api/classrooms/:id
 * Professor/owner only
 */
export const deleteClassroom = async (req, res) => {
  const classroom = await ClassroomModel.findById(req.params.id)
  if (!classroom) {
    return res.status(404).json({ error: 'Classroom not found' })
  }
  await ClassroomModel.delete(req.params.id)
  res.json({ message: 'Classroom deleted successfully' })
}

/**
 * GET /api/classrooms/:id/members
 * Get all members (membership required via middleware)
 */
export const getMembers = async (req, res) => {
  const members = await ClassroomModel.getMembers(req.params.id)
  res.json({ members })
}
