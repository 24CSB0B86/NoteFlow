const { query } = require('../config/db');

const logResult = (method, path, ok, detail = '') => {
  const icon = ok ? '✅' : '❌';
  console.log(`${icon} SYLLABUS ${method} ${path}${detail ? ' | ' + detail : ''}`);
};

/** Ensure user is a member of the classroom */
const checkMembership = async (classroomId, userId) => {
  const result = await query(
    'SELECT id FROM classroom_members WHERE classroom_id = $1 AND user_id = $2',
    [classroomId, userId]
  );
  return result.rows.length > 0;
};

/** Build a nested tree from a flat list of nodes */
const buildTree = (nodes) => {
  const map = {};
  const roots = [];
  nodes.forEach(n => { map[n.id] = { ...n, children: [] }; });
  nodes.forEach(n => {
    if (n.parent_id && map[n.parent_id]) {
      map[n.parent_id].children.push(map[n.id]);
    } else {
      roots.push(map[n.id]);
    }
  });
  const sort = (arr) => {
    arr.sort((a, b) => a.order_index - b.order_index);
    arr.forEach(n => sort(n.children));
  };
  sort(roots);
  return roots;
};

// ── GET /api/syllabus/:classroomId ────────────────────────────────────────────
const getSyllabus = async (req, res) => {
  const { classroomId } = req.params;
  try {
    if (!(await checkMembership(classroomId, req.user.id))) {
      logResult('GET', `/${classroomId}`, false, 'Not a member');
      return res.status(403).json({ error: 'Access denied' });
    }

    const syllabusResult = await query(
      'SELECT * FROM syllabus WHERE classroom_id = $1',
      [classroomId]
    );

    if (syllabusResult.rows.length === 0) {
      logResult('GET', `/${classroomId}`, true, 'No syllabus yet');
      return res.json({ syllabus: null, nodes: [], tree: [] });
    }

    const syllabus = syllabusResult.rows[0];

    const nodesResult = await query(
      `SELECT sn.*,
              (SELECT COUNT(*) FROM resources r WHERE r.syllabus_node_id = sn.id) AS resource_count
       FROM syllabus_nodes sn
       WHERE sn.syllabus_id = $1
       ORDER BY sn.order_index ASC`,
      [syllabus.id]
    );

    const tree = buildTree(nodesResult.rows);
    logResult('GET', `/${classroomId}`, true, `${nodesResult.rows.length} nodes`);
    return res.json({ syllabus, nodes: nodesResult.rows, tree });
  } catch (err) {
    logResult('GET', `/${classroomId}`, false, err.message);
    return res.status(500).json({ error: 'Failed to fetch syllabus', message: err.message });
  }
};

// ── POST /api/syllabus/:classroomId ──────────────────────────────────────────
const createOrUpdateSyllabus = async (req, res) => {
  const { classroomId } = req.params;
  try {
    // Verify professor owns this classroom
    const classResult = await query(
      'SELECT id FROM classrooms WHERE id = $1 AND professor_id = $2',
      [classroomId, req.user.id]
    );
    if (classResult.rows.length === 0) {
      logResult('POST', `/${classroomId}`, false, 'Not professor of this class');
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await query(
      `INSERT INTO syllabus (classroom_id, created_by)
       VALUES ($1, $2)
       ON CONFLICT (classroom_id) DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [classroomId, req.user.id]
    );

    logResult('POST', `/${classroomId}`, true, 'Syllabus initialized');
    return res.status(201).json({ syllabus: result.rows[0] });
  } catch (err) {
    logResult('POST', `/${classroomId}`, false, err.message);
    return res.status(500).json({ error: 'Failed to create syllabus', message: err.message });
  }
};

// ── POST /api/syllabus/:classroomId/nodes ─────────────────────────────────────
const addNode = async (req, res) => {
  const { classroomId } = req.params;
  const { parent_id, node_type, title, order_index } = req.body;

  if (!node_type || !title) {
    logResult('POST', `/${classroomId}/nodes`, false, 'Missing node_type or title');
    return res.status(400).json({ error: 'node_type and title are required' });
  }

  try {
    // Ensure syllabus exists
    let syllabusResult = await query('SELECT id FROM syllabus WHERE classroom_id = $1', [classroomId]);

    if (syllabusResult.rows.length === 0) {
      // Verify professor
      const classResult = await query(
        'SELECT id FROM classrooms WHERE id = $1 AND professor_id = $2',
        [classroomId, req.user.id]
      );
      if (classResult.rows.length === 0) {
        logResult('POST', `/${classroomId}/nodes`, false, 'Unauthorized');
        return res.status(403).json({ error: 'Access denied' });
      }
      syllabusResult = await query(
        'INSERT INTO syllabus (classroom_id, created_by) VALUES ($1, $2) RETURNING id',
        [classroomId, req.user.id]
      );
    }

    const syllabusId = syllabusResult.rows[0].id;

    // Calculate order_index if not provided
    let finalOrder = order_index;
    if (finalOrder === undefined || finalOrder === null) {
      const maxOrder = await query(
        'SELECT COALESCE(MAX(order_index), -1) AS max_order FROM syllabus_nodes WHERE syllabus_id = $1 AND (parent_id = $2 OR (parent_id IS NULL AND $2 IS NULL))',
        [syllabusId, parent_id || null]
      );
      finalOrder = maxOrder.rows[0].max_order + 1;
    }

    const result = await query(
      `INSERT INTO syllabus_nodes (syllabus_id, parent_id, node_type, title, order_index)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [syllabusId, parent_id || null, node_type, title, finalOrder]
    );

    logResult('POST', `/${classroomId}/nodes`, true, `"${title}" [${node_type}]`);
    return res.status(201).json({ node: result.rows[0] });
  } catch (err) {
    logResult('POST', `/${classroomId}/nodes`, false, err.message);
    return res.status(500).json({ error: 'Failed to add node', message: err.message });
  }
};

// ── PUT /api/syllabus/nodes/:nodeId ───────────────────────────────────────────
const updateNode = async (req, res) => {
  const { nodeId } = req.params;
  const { title, order_index, node_type } = req.body;

  try {
    const fields = [];
    const values = [];
    let paramIdx = 1;

    if (title !== undefined) { fields.push(`title = $${paramIdx++}`); values.push(title); }
    if (order_index !== undefined) { fields.push(`order_index = $${paramIdx++}`); values.push(order_index); }
    if (node_type !== undefined) { fields.push(`node_type = $${paramIdx++}`); values.push(node_type); }

    if (fields.length === 0) {
      logResult('PUT', `/nodes/${nodeId}`, false, 'No fields to update');
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(nodeId);
    const result = await query(
      `UPDATE syllabus_nodes SET ${fields.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      logResult('PUT', `/nodes/${nodeId}`, false, 'Not found');
      return res.status(404).json({ error: 'Node not found' });
    }

    logResult('PUT', `/nodes/${nodeId}`, true, result.rows[0].title);
    return res.json({ node: result.rows[0] });
  } catch (err) {
    logResult('PUT', `/nodes/${nodeId}`, false, err.message);
    return res.status(500).json({ error: 'Failed to update node', message: err.message });
  }
};

// ── DELETE /api/syllabus/nodes/:nodeId ────────────────────────────────────────
const deleteNode = async (req, res) => {
  const { nodeId } = req.params;
  try {
    const result = await query(
      'DELETE FROM syllabus_nodes WHERE id = $1 RETURNING title',
      [nodeId]
    );
    if (result.rows.length === 0) {
      logResult('DELETE', `/nodes/${nodeId}`, false, 'Not found');
      return res.status(404).json({ error: 'Node not found' });
    }
    logResult('DELETE', `/nodes/${nodeId}`, true, result.rows[0].title);
    return res.json({ message: 'Node deleted successfully' });
  } catch (err) {
    logResult('DELETE', `/nodes/${nodeId}`, false, err.message);
    return res.status(500).json({ error: 'Failed to delete node', message: err.message });
  }
};

// ── GET /api/syllabus/:classroomId/gap-analysis ───────────────────────────────
const getGapAnalysis = async (req, res) => {
  const { classroomId } = req.params;
  try {
    if (!(await checkMembership(classroomId, req.user.id))) {
      logResult('GET', `/${classroomId}/gap-analysis`, false, 'Not a member');
      return res.status(403).json({ error: 'Access denied' });
    }

    const syllabusResult = await query(
      'SELECT id FROM syllabus WHERE classroom_id = $1', [classroomId]
    );

    if (syllabusResult.rows.length === 0) {
      logResult('GET', `/${classroomId}/gap-analysis`, true, 'No syllabus');
      return res.json({ gaps: [], covered: [], summary: { total: 0, covered: 0, gaps: 0, coverage_percent: 0 } });
    }

    const nodesResult = await query(
      `SELECT sn.*,
              (SELECT COUNT(*) FROM resources r WHERE r.syllabus_node_id = sn.id) AS resource_count
       FROM syllabus_nodes sn
       WHERE sn.syllabus_id = $1`,
      [syllabusResult.rows[0].id]
    );

    const nodes = nodesResult.rows;
    const topics = nodes.filter(n => n.node_type !== 'unit');
    const gaps = topics.filter(n => parseInt(n.resource_count) === 0);
    const covered = topics.filter(n => parseInt(n.resource_count) > 0);
    const coveragePct = topics.length > 0 ? Math.round((covered.length / topics.length) * 100) : 0;

    logResult('GET', `/${classroomId}/gap-analysis`, true,
      `${gaps.length} gaps / ${topics.length} topics (${coveragePct}% covered)`);

    return res.json({
      gaps,
      covered,
      all_nodes: nodes,
      summary: {
        total: topics.length,
        covered: covered.length,
        gaps: gaps.length,
        coverage_percent: coveragePct,
      },
    });
  } catch (err) {
    logResult('GET', `/${classroomId}/gap-analysis`, false, err.message);
    return res.status(500).json({ error: 'Gap analysis failed', message: err.message });
  }
};

module.exports = { getSyllabus, createOrUpdateSyllabus, addNode, updateNode, deleteNode, getGapAnalysis };
