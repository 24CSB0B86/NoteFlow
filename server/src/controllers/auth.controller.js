import pool from '../config/db.js'
import supabaseAdmin from '../config/supabase.js'

/**
 * POST /api/auth/signup
 * Called after the user signs up via Supabase on the client.
 * Creates the user profile in our Neon DB.
 */
export const syncUserProfile = async (req, res) => {
  const { auth_id, email, full_name, role } = req.body

  if (!auth_id || !email || !full_name || !role) {
    return res.status(400).json({ error: 'Missing required fields: auth_id, email, full_name, role' })
  }

  if (!['professor', 'student'].includes(role)) {
    return res.status(400).json({ error: "Role must be 'professor' or 'student'" })
  }

  try {
    // Upsert to handle duplicate signup attempts gracefully
    const { rows } = await pool.query(
      `INSERT INTO users (auth_id, email, full_name, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (auth_id) DO UPDATE
         SET email     = EXCLUDED.email,
             full_name = EXCLUDED.full_name,
             updated_at = NOW()
       RETURNING *`,
      [auth_id, email, full_name, role]
    )

    res.status(201).json({ user: rows[0] })
  } catch (err) {
    console.error('syncUserProfile error:', err)
    if (err.code === '23505') {
      return res.status(409).json({ error: 'User with this email already exists' })
    }
    res.status(500).json({ error: 'Failed to create user profile' })
  }
}

/**
 * GET /api/auth/me
 * Returns the authenticated user's profile from Neon DB.
 */
export const getMe = async (req, res) => {
  try {
    res.json({ user: req.user })
  } catch (err) {
    console.error('getMe error:', err)
    res.status(500).json({ error: 'Failed to retrieve user profile' })
  }
}

/**
 * PUT /api/auth/me
 * Update authenticated user's profile (full_name, avatar_url).
 */
export const updateMe = async (req, res) => {
  const { full_name, avatar_url } = req.body
  const userId = req.user.id

  try {
    const { rows } = await pool.query(
      `UPDATE users
       SET full_name  = COALESCE($1, full_name),
           avatar_url = COALESCE($2, avatar_url),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [full_name, avatar_url, userId]
    )

    res.json({ user: rows[0] })
  } catch (err) {
    console.error('updateMe error:', err)
    res.status(500).json({ error: 'Failed to update profile' })
  }
}

/**
 * POST /api/auth/logout
 * Server-side logout — signs the user out via Supabase admin.
 */
export const logout = async (req, res) => {
  try {
    await supabaseAdmin.auth.admin.signOut(req.authUser.id)
    res.json({ message: 'Logged out successfully' })
  } catch (err) {
    console.error('logout error:', err)
    // Don't fail hard — the client already clears the session
    res.json({ message: 'Logged out' })
  }
}
