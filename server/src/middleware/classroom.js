import pool from '../config/db.js'

/**
 * Middleware: verify the authenticated user is a member of :classroomId
 */
export const requireClassroomMember = async (req, res, next) => {
  const classroomId = req.params.classroomId || req.params.id
  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM classroom_members
       WHERE classroom_id = $1 AND user_id = $2`,
      [classroomId, req.user.id]
    )
    if (rows.length === 0) {
      return res.status(403).json({ error: 'You are not a member of this classroom' })
    }
    next()
  } catch (err) {
    console.error('requireClassroomMember error:', err)
    res.status(500).json({ error: 'Membership check failed' })
  }
}

/**
 * Middleware: verify the authenticated user is the professor/owner of :classroomId or :id
 */
export const requireClassroomProfessor = async (req, res, next) => {
  const classroomId = req.params.classroomId || req.params.id
  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM classrooms
       WHERE id = $1 AND professor_id = $2`,
      [classroomId, req.user.id]
    )
    if (rows.length === 0) {
      return res.status(403).json({ error: 'Only the classroom professor can perform this action' })
    }
    next()
  } catch (err) {
    console.error('requireClassroomProfessor error:', err)
    res.status(500).json({ error: 'Permission check failed' })
  }
}
