import pool from '../config/db.js'

/**
 * User model — helper queries for the users table.
 */

export const findByAuthId = async (authId) => {
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE auth_id = $1',
    [authId]
  )
  return rows[0] || null
}

export const findById = async (id) => {
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE id = $1',
    [id]
  )
  return rows[0] || null
}

export const findByEmail = async (email) => {
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE email = $1',
    [email]
  )
  return rows[0] || null
}

export const createUser = async ({ auth_id, email, full_name, role }) => {
  const { rows } = await pool.query(
    `INSERT INTO users (auth_id, email, full_name, role)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [auth_id, email, full_name, role]
  )
  return rows[0]
}

export const updateUser = async (id, { full_name, avatar_url }) => {
  const { rows } = await pool.query(
    `UPDATE users
     SET full_name  = COALESCE($1, full_name),
         avatar_url = COALESCE($2, avatar_url),
         updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [full_name, avatar_url, id]
  )
  return rows[0] || null
}
