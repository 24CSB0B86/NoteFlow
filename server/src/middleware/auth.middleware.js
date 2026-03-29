const { supabaseAdmin } = require('../config/supabase');
const { query } = require('../config/db');

/**
 * Middleware: validate Supabase JWT and attach user to req.user
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn(`[Auth Middleware] ⛔ No Bearer token on ${req.method} ${req.path}`);
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    // Detect the literal string "undefined" sent when session?.access_token is undefined
    if (token === 'undefined' || token === 'null' || token.length < 10) {
      console.warn(`[Auth Middleware] ⛔ Invalid token value on ${req.method} ${req.path} – token: "${token}"`);
      return res.status(401).json({ error: 'Invalid token: null or undefined token received. Please log in again.' });
    }

    // Verify token with Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      console.warn(`[Auth Middleware] ⛔ Token verification failed on ${req.method} ${req.path} – ${error?.message}`);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Fetch user profile from our DB (includes role, full_name, etc.)
    const result = await query(
      'SELECT id, email, full_name, role, university_email, created_at FROM users WHERE id = $1',
      [user.id]
    );

    if (result.rows.length === 0) {
      console.warn(`[Auth Middleware] ⛔ User profile missing in DB for supabase user: ${user.id}`);
      return res.status(401).json({ error: 'User profile not found' });
    }

    req.user = result.rows[0];
    req.token = token;
    console.log(`[Auth Middleware] ✅ ${req.method} ${req.path} – user: ${req.user.email} [${req.user.role}]`);
    next();
  } catch (err) {
    console.error('[Auth Middleware] ❌ Unexpected error:', err.message);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

module.exports = { authenticate };
