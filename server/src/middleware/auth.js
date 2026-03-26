import supabaseAdmin from '../config/supabase.js'
import pool from '../config/db.js'

/**
 * Middleware: authenticate requests via Supabase JWT
 * Attaches req.user (from Neon DB) and req.authUser (from Supabase) to the request.
 */
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' })
    }

    const token = authHeader.split(' ')[1]

    // Verify token with Supabase
    const { data: { user: authUser }, error } = await supabaseAdmin.auth.getUser(token)

    if (error || !authUser) {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    // Fetch the user's profile from our Neon DB
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE auth_id = $1',
      [authUser.id]
    )

    if (rows.length === 0) {
      return res.status(401).json({
        error: 'User profile not found. Please complete registration.',
        code: 'PROFILE_NOT_FOUND',
      })
    }

    req.user = rows[0]       // Neon DB profile
    req.authUser = authUser  // Supabase auth user
    next()
  } catch (err) {
    console.error('Auth middleware error:', err)
    res.status(500).json({ error: 'Authentication failed' })
  }
}
