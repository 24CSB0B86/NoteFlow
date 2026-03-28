const { supabaseAdmin } = require('../config/supabase');
const { query } = require('../config/db');

/**
 * Middleware: validate Supabase JWT and attach user to req.user
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    // Verify token with Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Fetch user profile from our DB (includes role, full_name, etc.)
    const result = await query(
      'SELECT id, email, full_name, role, university_email, created_at FROM users WHERE id = $1',
      [user.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User profile not found' });
    }

    req.user = result.rows[0];
    req.token = token;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

module.exports = { authenticate };
