'use strict';
/**
 * chat.controller.js
 * Handles AI chatbot endpoints: send message, get history, clear history, rate message.
 */
const { query } = require('../config/db');
const { getChatResponse } = require('../services/aiService');

// ─── POST /api/chat ───────────────────────────────────────────────────────────
/**
 * Body: { message: string, classroom_id?: string }
 */
async function sendMessage(req, res) {
  try {
    const userId = req.user.id;
    const { message, classroom_id } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required.' });
    }
    if (message.trim().length > 1000) {
      return res.status(400).json({ error: 'Message is too long (max 1000 characters).' });
    }

    // 1. Fetch last 10 messages for context
    const historyResult = await query(
      `SELECT role, content FROM chat_messages
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [userId]
    );
    const history = historyResult.rows.reverse(); // oldest first

    // 2. Build optional classroom context string
    let contextText = '';
    if (classroom_id) {
      try {
        // Grab classroom info + recent resources for context
        const ctxResult = await query(
          `SELECT
             c.name AS classroom_name,
             c.code,
             COUNT(DISTINCT r.id) AS resource_count,
             COALESCE(
               string_agg(DISTINCT r.title, ', ' ORDER BY r.title) FILTER (WHERE r.title IS NOT NULL),
               'none yet'
             ) AS recent_resources
           FROM classrooms c
           LEFT JOIN resources r ON r.classroom_id = c.id AND r.status = 'approved'
           WHERE c.id = $1
           GROUP BY c.id, c.name, c.code`,
          [classroom_id]
        );
        if (ctxResult.rows.length > 0) {
          const ctx = ctxResult.rows[0];
          contextText = `The user is currently in classroom "${ctx.classroom_name}" (code: ${ctx.code}). ` +
            `It has ${ctx.resource_count} approved resources. ` +
            `Recent resources include: ${ctx.recent_resources}.`;
        }
      } catch (_) {
        // Non-fatal – continue without context
      }
    }

    // 3. Call AI
    const assistantReply = await getChatResponse(message.trim(), history, contextText);

    // 4. Persist user message
    await query(
      `INSERT INTO chat_messages (user_id, role, content, classroom_id)
       VALUES ($1, 'user', $2, $3)`,
      [userId, message.trim(), classroom_id || null]
    );

    // 5. Persist assistant reply
    const insertResult = await query(
      `INSERT INTO chat_messages (user_id, role, content, classroom_id)
       VALUES ($1, 'assistant', $2, $3)
       RETURNING id, created_at`,
      [userId, assistantReply, classroom_id || null]
    );

    return res.status(200).json({
      reply: assistantReply,
      message_id: insertResult.rows[0].id,
      created_at: insertResult.rows[0].created_at,
    });
  } catch (err) {
    console.error('[chat.controller] sendMessage error:', err);
    return res.status(500).json({ error: 'Failed to process your message. Please try again.' });
  }
}

// ─── GET /api/chat/history ────────────────────────────────────────────────────
async function getHistory(req, res) {
  try {
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
    const offset = parseInt(req.query.offset || '0', 10);

    const result = await query(
      `SELECT id, role, content, rating, created_at
       FROM chat_messages
       WHERE user_id = $1
       ORDER BY created_at ASC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const totalResult = await query(
      'SELECT COUNT(*) FROM chat_messages WHERE user_id = $1',
      [userId]
    );

    return res.json({
      messages: result.rows,
      total: parseInt(totalResult.rows[0].count, 10),
      limit,
      offset,
    });
  } catch (err) {
    console.error('[chat.controller] getHistory error:', err);
    return res.status(500).json({ error: 'Failed to fetch chat history.' });
  }
}

// ─── DELETE /api/chat/history ─────────────────────────────────────────────────
async function clearHistory(req, res) {
  try {
    const userId = req.user.id;
    await query('DELETE FROM chat_messages WHERE user_id = $1', [userId]);
    return res.json({ success: true, message: 'Chat history cleared.' });
  } catch (err) {
    console.error('[chat.controller] clearHistory error:', err);
    return res.status(500).json({ error: 'Failed to clear chat history.' });
  }
}

// ─── PATCH /api/chat/:messageId/rate ─────────────────────────────────────────
async function rateMessage(req, res) {
  try {
    const userId = req.user.id;
    const { messageId } = req.params;
    const { rating } = req.body; // true = thumbs up, false = thumbs down

    if (typeof rating !== 'boolean') {
      return res.status(400).json({ error: 'Rating must be true or false.' });
    }

    const result = await query(
      `UPDATE chat_messages
       SET rating = $1
       WHERE id = $2 AND user_id = $3 AND role = 'assistant'
       RETURNING id`,
      [rating, messageId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('[chat.controller] rateMessage error:', err);
    return res.status(500).json({ error: 'Failed to rate message.' });
  }
}

module.exports = { sendMessage, getHistory, clearHistory, rateMessage };
