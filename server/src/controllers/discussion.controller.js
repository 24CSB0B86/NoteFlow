'use strict';

const { query } = require('../config/db');

// ── POST /api/discussions ─────────────────────────────────────────────────────
const createDiscussion = async (req, res) => {
  try {
    const { resource_id, parent_id, content, page_number, position } = req.body;
    if (!resource_id || !content?.trim()) {
      return res.status(400).json({ error: 'resource_id and content are required' });
    }

    // Validate parent exists if provided
    if (parent_id) {
      const parentCheck = await query(
        `SELECT id FROM discussions WHERE id = $1 AND resource_id = $2`,
        [parent_id, resource_id]
      );
      if (parentCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Parent discussion not found' });
      }
    }

    const result = await query(
      `INSERT INTO discussions (resource_id, parent_id, user_id, content, page_number, position)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [resource_id, parent_id || null, req.user.id, content.trim(),
       page_number || null, position ? JSON.stringify(position) : null]
    );

    // Fetch with user info
    const full = await query(
      `SELECT d.*, u.full_name, u.avatar_url,
              0 AS upvotes, 0 AS downvotes, NULL AS user_vote
       FROM discussions d
       JOIN users u ON u.id = d.user_id
       WHERE d.id = $1`,
      [result.rows[0].id]
    );

    res.status(201).json({ discussion: full.rows[0] });
  } catch (err) {
    console.error('createDiscussion error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/discussions/:resourceId ─────────────────────────────────────────
const getDiscussions = async (req, res) => {
  try {
    const { resourceId } = req.params;
    const { page, sort = 'newest', resolved } = req.query;

    let whereClause = `d.resource_id = $1 AND d.parent_id IS NULL`;
    const params = [resourceId];
    let paramIdx = 2;

    if (page) {
      whereClause += ` AND d.page_number = $${paramIdx++}`;
      params.push(parseInt(page));
    }
    if (resolved === 'true') {
      whereClause += ` AND d.resolved = TRUE`;
    } else if (resolved === 'false') {
      whereClause += ` AND d.resolved = FALSE`;
    }

    const orderMap = {
      newest: 'd.created_at DESC',
      oldest: 'd.created_at ASC',
      votes: 'upvotes DESC',
      unresolved: 'd.resolved ASC, d.created_at DESC',
    };
    const orderBy = orderMap[sort] || orderMap.newest;

    const result = await query(
      `SELECT d.*, u.full_name, u.avatar_url,
              COALESCE(SUM(CASE WHEN dv.vote_type='up' THEN 1 ELSE 0 END), 0)::int AS upvotes,
              COALESCE(SUM(CASE WHEN dv.vote_type='down' THEN 1 ELSE 0 END), 0)::int AS downvotes,
              MAX(CASE WHEN dv.user_id = $${paramIdx} THEN dv.vote_type END) AS user_vote
       FROM discussions d
       JOIN users u ON u.id = d.user_id
       LEFT JOIN discussion_votes dv ON dv.discussion_id = d.id
       WHERE ${whereClause}
       GROUP BY d.id, u.full_name, u.avatar_url
       ORDER BY d.pinned DESC, ${orderBy}`,
      [...params, req.user.id]
    );

    // Fetch nested replies for each thread
    const threads = await Promise.all(result.rows.map(async (thread) => {
      const replies = await query(
        `SELECT d.*, u.full_name, u.avatar_url,
                COALESCE(SUM(CASE WHEN dv.vote_type='up' THEN 1 ELSE 0 END), 0)::int AS upvotes,
                COALESCE(SUM(CASE WHEN dv.vote_type='down' THEN 1 ELSE 0 END), 0)::int AS downvotes,
                MAX(CASE WHEN dv.user_id = $2 THEN dv.vote_type END) AS user_vote
         FROM discussions d
         JOIN users u ON u.id = d.user_id
         LEFT JOIN discussion_votes dv ON dv.discussion_id = d.id
         WHERE d.parent_id = $1
         GROUP BY d.id, u.full_name, u.avatar_url
         ORDER BY d.created_at ASC`,
        [thread.id, req.user.id]
      );
      return { ...thread, replies: replies.rows };
    }));

    res.json({ discussions: threads });
  } catch (err) {
    console.error('getDiscussions error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ── PUT /api/discussions/:id ──────────────────────────────────────────────────
const updateDiscussion = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Content required' });

    const result = await query(
      `UPDATE discussions SET content = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3 RETURNING *`,
      [content.trim(), id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Discussion not found or not yours' });
    }
    res.json({ discussion: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── DELETE /api/discussions/:id ───────────────────────────────────────────────
const deleteDiscussion = async (req, res) => {
  try {
    const { id } = req.params;
    let sql, params;

    if (req.user.role === 'professor') {
      // Professor can delete any
      sql = `DELETE FROM discussions WHERE id = $1 RETURNING id`;
      params = [id];
    } else {
      sql = `DELETE FROM discussions WHERE id = $1 AND user_id = $2 RETURNING id`;
      params = [id, req.user.id];
    }

    const result = await query(sql, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Discussion not found or not authorized' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── POST /api/discussions/:id/vote ────────────────────────────────────────────
const voteDiscussion = async (req, res) => {
  try {
    const { id } = req.params;
    const { vote_type } = req.body; // 'up', 'down', or null to remove

    if (vote_type && !['up', 'down'].includes(vote_type)) {
      return res.status(400).json({ error: 'vote_type must be "up", "down", or null' });
    }

    if (!vote_type) {
      // Remove vote
      await query(
        `DELETE FROM discussion_votes WHERE discussion_id = $1 AND user_id = $2`,
        [id, req.user.id]
      );
    } else {
      // Upsert vote
      await query(
        `INSERT INTO discussion_votes (discussion_id, user_id, vote_type)
         VALUES ($1, $2, $3)
         ON CONFLICT (discussion_id, user_id) DO UPDATE SET vote_type = $3`,
        [id, req.user.id, vote_type]
      );
    }

    // Return updated counts
    const counts = await query(
      `SELECT
         COALESCE(SUM(CASE WHEN vote_type='up' THEN 1 ELSE 0 END),0)::int AS upvotes,
         COALESCE(SUM(CASE WHEN vote_type='down' THEN 1 ELSE 0 END),0)::int AS downvotes
       FROM discussion_votes WHERE discussion_id = $1`,
      [id]
    );
    res.json({ ...counts.rows[0], user_vote: vote_type || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── POST /api/discussions/:id/resolve (toggle) ────────────────────────────────
const resolveDiscussion = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `UPDATE discussions SET resolved = NOT resolved WHERE id = $1 RETURNING resolved`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ resolved: result.rows[0].resolved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── POST /api/discussions/:id/pin (Professor only) ────────────────────────────
const pinDiscussion = async (req, res) => {
  try {
    if (req.user.role !== 'professor') {
      return res.status(403).json({ error: 'Only professors can pin discussions' });
    }
    const { id } = req.params;
    const result = await query(
      `UPDATE discussions SET pinned = NOT pinned WHERE id = $1 RETURNING pinned`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ pinned: result.rows[0].pinned });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  createDiscussion,
  getDiscussions,
  updateDiscussion,
  deleteDiscussion,
  voteDiscussion,
  resolveDiscussion,
  pinDiscussion,
};
