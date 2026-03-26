import pool from '../config/db.js'

/** Generate a 6-character alphanumeric invite code */
const generateInviteCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous chars
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

/** Ensure uniqueness by retrying up to 5 times */
const uniqueInviteCode = async () => {
  for (let i = 0; i < 5; i++) {
    const code = generateInviteCode()
    const { rows } = await pool.query(
      'SELECT 1 FROM classrooms WHERE invite_code = $1',
      [code]
    )
    if (rows.length === 0) return code
  }
  throw new Error('Failed to generate unique invite code')
}

export const ClassroomModel = {
  async create({ name, section, description, professorId }) {
    const inviteCode = await uniqueInviteCode()
    const { rows } = await pool.query(
      `INSERT INTO classrooms (name, section, description, professor_id, invite_code)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, section || null, description || null, professorId, inviteCode]
    )
    // Auto-add professor as member
    await pool.query(
      `INSERT INTO classroom_members (classroom_id, user_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [rows[0].id, professorId]
    )
    return rows[0]
  },

  async findByInviteCode(code) {
    const { rows } = await pool.query(
      `SELECT c.*, u.full_name AS professor_name
       FROM classrooms c
       JOIN users u ON u.id = c.professor_id
       WHERE c.invite_code = $1 AND c.is_active = TRUE`,
      [code.toUpperCase()]
    )
    return rows[0] || null
  },

  async addMember(classroomId, userId) {
    const { rows } = await pool.query(
      `INSERT INTO classroom_members (classroom_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (classroom_id, user_id) DO NOTHING
       RETURNING *`,
      [classroomId, userId]
    )
    return rows[0]
  },

  async findById(id) {
    const { rows } = await pool.query(
      `SELECT c.*,
              u.full_name AS professor_name,
              COUNT(cm.id)::int AS member_count
       FROM classrooms c
       JOIN users u ON u.id = c.professor_id
       LEFT JOIN classroom_members cm ON cm.classroom_id = c.id
       WHERE c.id = $1
       GROUP BY c.id, u.full_name`,
      [id]
    )
    return rows[0] || null
  },

  async findByUser(userId) {
    const { rows } = await pool.query(
      `SELECT c.*,
              u.full_name AS professor_name,
              COUNT(cm2.id)::int AS member_count,
              cm.joined_at
       FROM classroom_members cm
       JOIN classrooms c ON c.id = cm.classroom_id
       JOIN users u ON u.id = c.professor_id
       LEFT JOIN classroom_members cm2 ON cm2.classroom_id = c.id
       WHERE cm.user_id = $1 AND c.is_active = TRUE
       GROUP BY c.id, u.full_name, cm.joined_at
       ORDER BY cm.joined_at DESC`,
      [userId]
    )
    return rows
  },

  async delete(classroomId) {
    await pool.query('DELETE FROM classrooms WHERE id = $1', [classroomId])
  },

  async getMembers(classroomId) {
    const { rows } = await pool.query(
      `SELECT u.id, u.full_name, u.email, u.role, u.avatar_url, cm.joined_at
       FROM classroom_members cm
       JOIN users u ON u.id = cm.user_id
       WHERE cm.classroom_id = $1
       ORDER BY u.role DESC, u.full_name ASC`,
      [classroomId]
    )
    return rows
  },
}
