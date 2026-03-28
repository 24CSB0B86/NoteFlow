const { supabaseAdmin } = require('../config/supabase');
const { query } = require('../config/db');

// ── helpers ──────────────────────────────────────────────────────────────────

const logResult = (method, path, ok, detail = '') => {
  const icon = ok ? '✅' : '❌';
  console.log(`${icon} AUTH ${method} ${path}${detail ? ' | ' + detail : ''}`);
};

// ── POST /api/auth/signup ─────────────────────────────────────────────────────
const signup = async (req, res) => {
  const { email, password, full_name, role } = req.body;

  if (!email || !password || !full_name || !role) {
    logResult('POST', '/signup', false, 'Missing fields');
    return res.status(400).json({ error: 'Email, password, full_name, and role are required' });
  }

  if (!['professor', 'student'].includes(role)) {
    logResult('POST', '/signup', false, 'Invalid role');
    return res.status(400).json({ error: 'Role must be professor or student' });
  }

  if (password.length < 8) {
    logResult('POST', '/signup', false, 'Weak password');
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    // 1. Create Supabase auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,         // auto-confirm for edu platform
      user_metadata: { full_name, role },
    });

    if (authError) {
      logResult('POST', '/signup', false, authError.message);
      return res.status(400).json({ error: authError.message });
    }

    // 2. Upsert user profile in Neon DB
    await query(
      `INSERT INTO users (id, email, full_name, role, university_email)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, role = EXCLUDED.role`,
      [authData.user.id, email, full_name, role, email]
    );

    logResult('POST', '/signup', true, `User created: ${email} [${role}]`);
    return res.status(201).json({
      message: 'Account created successfully',
      user: { id: authData.user.id, email, full_name, role },
    });
  } catch (err) {
    logResult('POST', '/signup', false, err.message);
    return res.status(500).json({ error: 'Signup failed', message: err.message });
  }
};

// ── POST /api/auth/login ──────────────────────────────────────────────────────
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    logResult('POST', '/login', false, 'Missing credentials');
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });

    if (error) {
      logResult('POST', '/login', false, error.message);
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Ensure profile exists in Neon DB
    const result = await query('SELECT * FROM users WHERE id = $1', [data.user.id]);

    if (result.rows.length === 0) {
      // Profile missing – create it from Supabase metadata
      const meta = data.user.user_metadata || {};
      await query(
        `INSERT INTO users (id, email, full_name, role, university_email)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
        [data.user.id, email, meta.full_name || email, meta.role || 'student', email]
      );
    }

    const freshUser = (await query('SELECT id, email, full_name, role FROM users WHERE id = $1', [data.user.id])).rows[0];

    logResult('POST', '/login', true, `${email} [${freshUser.role}]`);
    return res.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: freshUser,
    });
  } catch (err) {
    logResult('POST', '/login', false, err.message);
    return res.status(500).json({ error: 'Login failed', message: err.message });
  }
};

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
const me = async (req, res) => {
  logResult('GET', '/me', true, `User: ${req.user.email}`);
  return res.json({ user: req.user });
};

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
const logout = async (req, res) => {
  try {
    await supabaseAdmin.auth.admin.signOut(req.token);
    logResult('POST', '/logout', true);
    return res.json({ message: 'Logged out successfully' });
  } catch (err) {
    logResult('POST', '/logout', false, err.message);
    return res.status(500).json({ error: 'Logout failed' });
  }
};

// ── POST /api/auth/reset-password ────────────────────────────────────────────
const resetPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    logResult('POST', '/reset-password', false, 'Missing email');
    return res.status(400).json({ error: 'Email is required' });
  }
  try {
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.CLIENT_URL}/reset-password`,
    });
    if (error) {
      logResult('POST', '/reset-password', false, error.message);
      return res.status(400).json({ error: error.message });
    }
    logResult('POST', '/reset-password', true, email);
    return res.json({ message: 'Password reset email sent' });
  } catch (err) {
    logResult('POST', '/reset-password', false, err.message);
    return res.status(500).json({ error: 'Failed to send reset email' });
  }
};

// ── POST /api/auth/verify-email ───────────────────────────────────────────────
const verifyEmail = async (req, res) => {
  // Supabase handles verification via magic link; this endpoint is a stub
  logResult('POST', '/verify-email', true);
  return res.json({ message: 'Email verified (handled by Supabase)' });
};

module.exports = { signup, login, me, logout, resetPassword, verifyEmail };
