'use strict';

const { query } = require('../config/db');
const { _scheduleHeatmapRecalc } = require('../services/heatmapService');

// ── POST /api/highlights ──────────────────────────────────────────────────────
const createHighlight = async (req, res) => {
  try {
    const { resource_id, page_number, coordinates, text_content, color } = req.body;
    if (!resource_id || page_number == null || !coordinates) {
      return res.status(400).json({ error: 'resource_id, page_number, and coordinates are required' });
    }
    // Validate coordinates format
    const { x1, y1, x2, y2 } = coordinates;
    if ([x1, y1, x2, y2].some(v => v == null || v < 0 || v > 1)) {
      return res.status(400).json({ error: 'Coordinates must be normalized values between 0 and 1' });
    }

    const result = await query(
      `INSERT INTO highlights (resource_id, user_id, page_number, coordinates, text_content, color)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [resource_id, req.user.id, page_number, JSON.stringify(coordinates),
       text_content || null, color || '#facc15']
    );

    // Schedule debounced heatmap recalculation
    _scheduleHeatmapRecalc(resource_id, page_number);

    res.status(201).json({ highlight: result.rows[0] });
  } catch (err) {
    console.error('createHighlight error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/highlights/:resourceId ──────────────────────────────────────────
const getHighlights = async (req, res) => {
  try {
    const { resourceId } = req.params;
    const { page } = req.query;

    let sql = `SELECT h.*, u.full_name
               FROM highlights h
               JOIN users u ON u.id = h.user_id
               WHERE h.resource_id = $1`;
    const params = [resourceId];

    if (page) {
      sql += ` AND h.page_number = $2`;
      params.push(parseInt(page));
    }
    sql += ` ORDER BY h.created_at ASC`;

    const result = await query(sql, params);

    // Split into own and others
    const own = result.rows.filter(h => h.user_id === req.user.id);
    const others = result.rows.filter(h => h.user_id !== req.user.id);

    res.json({ own, others, total: result.rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── DELETE /api/highlights/:id ────────────────────────────────────────────────
const deleteHighlight = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query(
      `DELETE FROM highlights WHERE id = $1 AND user_id = $2 RETURNING resource_id, page_number`,
      [id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Highlight not found or not yours' });
    }
    const { resource_id, page_number } = result.rows[0];
    _scheduleHeatmapRecalc(resource_id, page_number);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { createHighlight, getHighlights, deleteHighlight };
