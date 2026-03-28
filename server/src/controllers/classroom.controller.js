const { query } = require('../config/db');

// Generate 6-character alphanumeric invite code (uppercase)
const generateInviteCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

const logResult = (method, path, ok, detail = '') => {
  const icon = ok ? '✅' : '❌';
  console.log(`${icon} CLASSROOM ${method} ${path}${detail ? ' | ' + detail : ''}`);
};

// ── POST /api/classrooms ──────────────────────────────────────────────────────
const createClassroom = async (req, res) => {
  const { name, section, description } = req.body;

  if (!name || !section) {
    logResult('POST', '/', false, 'Missing name or section');
    return res.status(400).json({ error: 'Class name and section are required' });
  }

  try {
    // Generate unique invite code
    let invite_code, attempts = 0;
    do {
      invite_code = generateInviteCode();
      const existing = await query('SELECT id FROM classrooms WHERE invite_code = $1', [invite_code]);
      if (existing.rows.length === 0) break;
    } while (++attempts < 10);

    const result = await query(
      `INSERT INTO classrooms (name, section, professor_id, invite_code, description)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, section, req.user.id, invite_code, description || null]
    );

    const classroom = result.rows[0];

    // Professor joins their own classroom as member
    await query(
      `INSERT INTO classroom_members (classroom_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [classroom.id, req.user.id]
    );

    logResult('POST', '/', true, `"${name}" (code: ${invite_code}) by ${req.user.email}`);
    return res.status(201).json({ classroom });
  } catch (err) {
    logResult('POST', '/', false, err.message);
    return res.status(500).json({ error: 'Failed to create classroom', message: err.message });
  }
};

// ── POST /api/classrooms/join ─────────────────────────────────────────────────
const joinClassroom = async (req, res) => {
  const { invite_code } = req.body;

  if (!invite_code) {
    logResult('POST', '/join', false, 'Missing invite code');
    return res.status(400).json({ error: 'Invite code is required' });
  }

  try {
    const classResult = await query(
      'SELECT * FROM classrooms WHERE invite_code = $1',
      [invite_code.toUpperCase().trim()]
    );

    if (classResult.rows.length === 0) {
      logResult('POST', '/join', false, `Invalid code: ${invite_code}`);
      return res.status(404).json({ error: 'Invalid invite code' });
    }

    const classroom = classResult.rows[0];

    // Professor cannot join with a student invite code
    if (req.user.role === 'professor' && classroom.professor_id !== req.user.id) {
      logResult('POST', '/join', false, 'Professor tried to join another classroom');
      return res.status(403).json({ error: 'Professors cannot join classrooms they do not own' });
    }

    const existing = await query(
      'SELECT id FROM classroom_members WHERE classroom_id = $1 AND user_id = $2',
      [classroom.id, req.user.id]
    );

    if (existing.rows.length > 0) {
      logResult('POST', '/join', false, 'Already a member');
      return res.status(409).json({ error: 'You are already a member of this classroom' });
    }

    await query(
      'INSERT INTO classroom_members (classroom_id, user_id) VALUES ($1, $2)',
      [classroom.id, req.user.id]
    );

    logResult('POST', '/join', true, `${req.user.email} joined "${classroom.name}"`);
    return res.json({ message: 'Joined classroom successfully', classroom });
  } catch (err) {
    logResult('POST', '/join', false, err.message);
    return res.status(500).json({ error: 'Failed to join classroom', message: err.message });
  }
};

// ── GET /api/classrooms/my-classes ────────────────────────────────────────────
const getMyClassrooms = async (req, res) => {
  try {
    const result = await query(
      `SELECT c.*, u.full_name AS professor_name,
              (SELECT COUNT(*) FROM classroom_members cm WHERE cm.classroom_id = c.id) AS member_count
       FROM classrooms c
       JOIN classroom_members cm2 ON cm2.classroom_id = c.id AND cm2.user_id = $1
       JOIN users u ON u.id = c.professor_id
       ORDER BY c.created_at DESC`,
      [req.user.id]
    );
    logResult('GET', '/my-classes', true, `${result.rows.length} classrooms for ${req.user.email}`);
    return res.json({ classrooms: result.rows });
  } catch (err) {
    logResult('GET', '/my-classes', false, err.message);
    return res.status(500).json({ error: 'Failed to fetch classrooms', message: err.message });
  }
};

// ── GET /api/classrooms/:id ───────────────────────────────────────────────────
const getClassroom = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await query(
      `SELECT c.*, u.full_name AS professor_name,
              (SELECT COUNT(*) FROM classroom_members cm WHERE cm.classroom_id = c.id) AS member_count
       FROM classrooms c
       JOIN users u ON u.id = c.professor_id
       WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      logResult('GET', `/${id}`, false, 'Not found');
      return res.status(404).json({ error: 'Classroom not found' });
    }

    // Check membership
    const memberCheck = await query(
      'SELECT id FROM classroom_members WHERE classroom_id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (memberCheck.rows.length === 0) {
      logResult('GET', `/${id}`, false, 'Not a member');
      return res.status(403).json({ error: 'Access denied: not a member of this classroom' });
    }

    logResult('GET', `/${id}`, true, result.rows[0].name);
    return res.json({ classroom: result.rows[0] });
  } catch (err) {
    logResult('GET', `/${id}`, false, err.message);
    return res.status(500).json({ error: 'Failed to fetch classroom', message: err.message });
  }
};

// ── GET /api/classrooms/:id/members ──────────────────────────────────────────
const getMembers = async (req, res) => {
  const { id } = req.params;
  try {
    // Check membership
    const memberCheck = await query(
      'SELECT id FROM classroom_members WHERE classroom_id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    if (memberCheck.rows.length === 0) {
      logResult('GET', `/${id}/members`, false, 'Not a member');
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await query(
      `SELECT u.id, u.full_name, u.email, u.role, cm.joined_at
       FROM classroom_members cm
       JOIN users u ON u.id = cm.user_id
       WHERE cm.classroom_id = $1
       ORDER BY u.role DESC, u.full_name ASC`,
      [id]
    );

    logResult('GET', `/${id}/members`, true, `${result.rows.length} members`);
    return res.json({ members: result.rows });
  } catch (err) {
    logResult('GET', `/${id}/members`, false, err.message);
    return res.status(500).json({ error: 'Failed to fetch members', message: err.message });
  }
};

// ── DELETE /api/classrooms/:id ────────────────────────────────────────────────
const deleteClassroom = async (req, res) => {
  const { id } = req.params;
  try {
    const classResult = await query('SELECT * FROM classrooms WHERE id = $1', [id]);

    if (classResult.rows.length === 0) {
      logResult('DELETE', `/${id}`, false, 'Not found');
      return res.status(404).json({ error: 'Classroom not found' });
    }

    if (classResult.rows[0].professor_id !== req.user.id) {
      logResult('DELETE', `/${id}`, false, 'Unauthorized');
      return res.status(403).json({ error: 'Only the professor can delete this classroom' });
    }

    await query('DELETE FROM classrooms WHERE id = $1', [id]);
    logResult('DELETE', `/${id}`, true, classResult.rows[0].name);
    return res.json({ message: 'Classroom deleted successfully' });
  } catch (err) {
    logResult('DELETE', `/${id}`, false, err.message);
    return res.status(500).json({ error: 'Failed to delete classroom', message: err.message });
  }
};

module.exports = { createClassroom, joinClassroom, getMyClassrooms, getClassroom, getMembers, deleteClassroom };
