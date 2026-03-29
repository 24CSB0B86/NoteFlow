'use strict';

const { query } = require('../config/db');
const {
  awardKarma,
  createNotification,
} = require('../services/karmaEngine');
const {
  sendBountyClaimedEmail,
  sendBountySubmittedEmail,
  sendBountyApprovedEmail,
  sendBountyRejectedEmail,
} = require('../services/emailService');

const DEFAULT_EXPIRY_DAYS = 7;

// Safe email wrapper (non-fatal)
async function safeEmail(fn, label) {
  try { await fn(); } catch (e) { console.warn(`[Bounty] ⚠️ Email "${label}" failed (non-fatal):`, e.message); }
}

// Helper: get bounty + requester info
async function _getRequester(bountyId) {
  console.log(`[Bounty] DB: SELECT bounty+requester for bountyId: ${bountyId}`);
  const r = await query(
    `SELECT b.*, u.email, u.full_name FROM bounties b JOIN users u ON u.id = b.requester_id WHERE b.id = $1`,
    [bountyId]
  );
  return r.rows[0];
}

// ── POST /api/bounties ─────────────────────────────────────────────────────────
const createBounty = async (req, res) => {
  try {
    const { classroom_id, syllabus_node_id, title, description, points_reward, is_urgent, expires_in_days } = req.body;
    console.log(`[Bounty] POST / – classroom: ${classroom_id} title: "${title}" user: ${req.user.id}`);

    if (!classroom_id || !title || !description) {
      return res.status(400).json({ error: 'classroom_id, title, and description are required' });
    }

    // Verify membership
    const memberCheck = await query(
      `SELECT 1 FROM classroom_members WHERE classroom_id = $1 AND user_id = $2
       UNION SELECT 1 FROM classrooms WHERE id = $1 AND professor_id = $2`,
      [classroom_id, req.user.id]
    );
    if (memberCheck.rows.length === 0) {
      console.warn(`[Bounty] ⛔ User ${req.user.id} is not a member of classroom ${classroom_id}`);
      return res.status(403).json({ error: 'Not a classroom member' });
    }

    const basePoints = parseInt(points_reward || 10);
    const finalPoints = is_urgent ? basePoints * 2 : basePoints;
    const expiresAt = new Date(Date.now() + (parseInt(expires_in_days || DEFAULT_EXPIRY_DAYS)) * 86400000);

    const result = await query(
      `INSERT INTO bounties (classroom_id, syllabus_node_id, requester_id, title, description,
         points_reward, is_urgent, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [classroom_id, syllabus_node_id || null, req.user.id, title, description,
       finalPoints, !!is_urgent, expiresAt]
    );

    console.log(`[Bounty] ✅ Created bounty: ${result.rows[0].id} – points: ${finalPoints}`);
    res.status(201).json({ success: true, bounty: result.rows[0] });
  } catch (err) {
    console.error('[Bounty] ❌ createBounty error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/bounties/:classroomId ─────────────────────────────────────────────
const getBounties = async (req, res) => {
  try {
    const { classroomId } = req.params;
    const { status, nodeId, sortBy = 'newest', search } = req.query;
    console.log(`[Bounty] GET /${classroomId} – status: ${status} sortBy: ${sortBy} search: "${search}"`);

    let where = `b.classroom_id = $1`;
    const params = [classroomId];
    let idx = 2;

    if (status) { where += ` AND b.status = $${idx++}`; params.push(status); }
    if (nodeId) { where += ` AND b.syllabus_node_id = $${idx++}`; params.push(nodeId); }
    if (search) { where += ` AND (b.title ILIKE $${idx} OR b.description ILIKE $${idx})`; params.push(`%${search}%`); idx++; }

    // Auto-expire open bounties past their expiry date
    await query(`UPDATE bounties SET status = 'expired' WHERE expires_at < NOW() AND status = 'open'`);

    const orderMap = {
      newest:   'b.created_at DESC',
      oldest:   'b.created_at ASC',
      points:   'b.points_reward DESC',
      expiring: 'b.expires_at ASC',
    };

    const result = await query(
      `SELECT b.*, u.full_name AS requester_name, u.avatar_url AS requester_avatar,
              n.title AS node_title,
              claimer.full_name AS claimer_name,
              (SELECT COUNT(*) FROM bounty_submissions WHERE bounty_id = b.id) AS submission_count
       FROM bounties b
       JOIN users u ON u.id = b.requester_id
       LEFT JOIN syllabus_nodes n ON n.id = b.syllabus_node_id
       LEFT JOIN users claimer ON claimer.id = b.claimer_id
       WHERE ${where}
       ORDER BY b.is_urgent DESC, ${orderMap[sortBy] || orderMap.newest}`,
      params
    );

    console.log(`[Bounty] ✅ getBounties – returned ${result.rows.length} bounties for classroom ${classroomId}`);
    res.json({ bounties: result.rows });
  } catch (err) {
    console.error('[Bounty] ❌ getBounties error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/bounties/my-bounties ─────────────────────────────────────────────
const getMyBounties = async (req, res) => {
  try {
    console.log(`[Bounty] GET /my-bounties – user: ${req.user.id}`);

    const created = await query(
      `SELECT b.*, n.title AS node_title,
              (SELECT COUNT(*) FROM bounty_submissions WHERE bounty_id = b.id) AS submission_count
       FROM bounties b LEFT JOIN syllabus_nodes n ON n.id = b.syllabus_node_id
       WHERE b.requester_id = $1 ORDER BY b.created_at DESC`,
      [req.user.id]
    );
    const claimed = await query(
      `SELECT b.*, u.full_name AS requester_name, n.title AS node_title,
              bs.status AS submission_status, bs.id AS submission_id
       FROM bounties b
       JOIN users u ON u.id = b.requester_id
       LEFT JOIN syllabus_nodes n ON n.id = b.syllabus_node_id
       LEFT JOIN bounty_submissions bs ON bs.bounty_id = b.id AND bs.fulfiller_id = $1
       WHERE b.claimer_id = $1 OR bs.fulfiller_id = $1
       ORDER BY b.created_at DESC`,
      [req.user.id]
    );

    console.log(`[Bounty] ✅ getMyBounties – created: ${created.rows.length} claimed: ${claimed.rows.length}`);
    res.json({ created: created.rows, claimed: claimed.rows });
  } catch (err) {
    console.error('[Bounty] ❌ getMyBounties error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ── POST /api/bounties/:id/claim ──────────────────────────────────────────────
const claimBounty = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[Bounty] POST /${id}/claim – user: ${req.user.id}`);

    const bountyRes = await query(`SELECT * FROM bounties WHERE id = $1`, [id]);
    if (bountyRes.rows.length === 0) return res.status(404).json({ error: 'Bounty not found' });

    const b = bountyRes.rows[0];
    if (b.status !== 'open') return res.status(400).json({ error: `Cannot claim a bounty with status: ${b.status}` });
    if (b.requester_id === req.user.id) return res.status(400).json({ error: 'Cannot claim your own bounty' });

    await query(
      `UPDATE bounties SET status = 'claimed', claimer_id = $1, claimed_at = NOW() WHERE id = $2`,
      [req.user.id, id]
    );

    // Notify requester
    const requester = await query(`SELECT email, full_name FROM users WHERE id = $1`, [b.requester_id]);
    if (requester.rows[0]) {
      await createNotification(b.requester_id, 'bounty_claimed',
        '🏹 Your bounty was claimed!', `${req.user.full_name} is working on "${b.title}"`, `/bounties`);
      await safeEmail(
        () => sendBountyClaimedEmail(requester.rows[0].email, requester.rows[0].full_name, b.title, req.user.full_name),
        'bounty_claimed'
      );
    }

    console.log(`[Bounty] ✅ Bounty ${id} claimed by user ${req.user.id}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[Bounty] ❌ claimBounty error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ── POST /api/bounties/:id/submit ─────────────────────────────────────────────
const submitBounty = async (req, res) => {
  try {
    const { id } = req.params;
    const { resource_id, note } = req.body;
    console.log(`[Bounty] POST /${id}/submit – user: ${req.user.id} resource: ${resource_id}`);

    const bountyRes = await query(`SELECT * FROM bounties WHERE id = $1`, [id]);
    if (bountyRes.rows.length === 0) return res.status(404).json({ error: 'Bounty not found' });

    const b = bountyRes.rows[0];
    if (b.status !== 'claimed') return res.status(400).json({ error: 'Bounty must be claimed first' });
    if (b.claimer_id !== req.user.id) return res.status(403).json({ error: 'Only the claimer can submit' });

    const existing = await query(
      `SELECT id FROM bounty_submissions WHERE bounty_id = $1 AND fulfiller_id = $2 AND status = 'pending'`,
      [id, req.user.id]
    );
    if (existing.rows.length > 0) return res.status(400).json({ error: 'You already have a pending submission' });

    const result = await query(
      `INSERT INTO bounty_submissions (bounty_id, fulfiller_id, resource_id, note) VALUES ($1,$2,$3,$4) RETURNING *`,
      [id, req.user.id, resource_id || null, note || null]
    );

    // Notify requester
    const requesterRes = await query(`SELECT email, full_name FROM users WHERE id = $1`, [b.requester_id]);
    if (requesterRes.rows[0]) {
      await createNotification(b.requester_id, 'bounty_submitted',
        '📬 Bounty submission received!', `Review the submission for "${b.title}"`, `/bounties`);
      await safeEmail(
        () => sendBountySubmittedEmail(requesterRes.rows[0].email, requesterRes.rows[0].full_name, b.title),
        'bounty_submitted'
      );
    }

    console.log(`[Bounty] ✅ Submission created: ${result.rows[0].id}`);
    res.status(201).json({ success: true, submission: result.rows[0] });
  } catch (err) {
    console.error('[Bounty] ❌ submitBounty error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ── POST /api/bounties/:id/approve ────────────────────────────────────────────
const approveBounty = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[Bounty] POST /${id}/approve – user: ${req.user.id}`);

    const bounty = await _getRequester(id);
    if (!bounty) return res.status(404).json({ error: 'Bounty not found' });

    // Only requester or professor can approve
    if (bounty.requester_id !== req.user.id && req.user.role !== 'professor') {
      return res.status(403).json({ error: 'Only the requester or professor can approve' });
    }

    const sub = await query(
      `SELECT bs.*, u.email, u.full_name FROM bounty_submissions bs
       JOIN users u ON u.id = bs.fulfiller_id
       WHERE bs.bounty_id = $1 AND bs.status = 'pending' LIMIT 1`,
      [id]
    );
    if (sub.rows.length === 0) return res.status(404).json({ error: 'No pending submission' });

    const submission = sub.rows[0];

    // Update submission + bounty status
    await query(
      `UPDATE bounty_submissions SET status = 'approved', reviewed_by = $1, reviewed_at = NOW() WHERE id = $2`,
      [req.user.id, submission.id]
    );
    await query(`UPDATE bounties SET status = 'fulfilled' WHERE id = $1`, [id]);

    // If resource submitted, link it to the syllabus node
    if (submission.resource_id && bounty.syllabus_node_id) {
      await query(
        `UPDATE resources SET syllabus_node_id = $1 WHERE id = $2`,
        [bounty.syllabus_node_id, submission.resource_id]
      );
    }

    // Award karma to fulfiller
    const karmaResult = await awardKarma(submission.fulfiller_id, 'bounty_fulfill', id,
      `Fulfilled bounty: "${bounty.title}"`);

    console.log(`[Bounty] ✅ Bounty ${id} approved – karma awarded: ${karmaResult.pointsAwarded}`);

    // Notify fulfiller
    await createNotification(submission.fulfiller_id, 'bounty_approved',
      `⚡ Bounty approved! +${karmaResult.pointsAwarded} karma`,
      `Your submission for "${bounty.title}" was approved!`, `/profile`);
    await safeEmail(
      () => sendBountyApprovedEmail(submission.email, submission.full_name, bounty.title, karmaResult.pointsAwarded),
      'bounty_approved'
    );

    res.json({ success: true, karmaAwarded: karmaResult.pointsAwarded });
  } catch (err) {
    console.error('[Bounty] ❌ approveBounty error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ── POST /api/bounties/:id/reject ─────────────────────────────────────────────
const rejectBounty = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    console.log(`[Bounty] POST /${id}/reject – reason: ${reason}`);

    const bounty = await _getRequester(id);
    if (!bounty) return res.status(404).json({ error: 'Bounty not found' });

    if (bounty.requester_id !== req.user.id && req.user.role !== 'professor') {
      return res.status(403).json({ error: 'Only the requester or professor can reject' });
    }

    const sub = await query(
      `SELECT bs.*, u.email, u.full_name FROM bounty_submissions bs
       JOIN users u ON u.id = bs.fulfiller_id
       WHERE bs.bounty_id = $1 AND bs.status = 'pending' LIMIT 1`,
      [id]
    );
    if (sub.rows.length === 0) return res.status(404).json({ error: 'No pending submission' });

    await query(
      `UPDATE bounty_submissions SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW() WHERE id = $2`,
      [req.user.id, sub.rows[0].id]
    );
    // Reopen bounty for re-claim
    await query(`UPDATE bounties SET status = 'open', claimer_id = NULL, claimed_at = NULL WHERE id = $1`, [id]);

    console.log(`[Bounty] ✅ Bounty ${id} submission rejected – bounty reopened`);

    // Notify fulfiller
    await createNotification(sub.rows[0].fulfiller_id, 'bounty_rejected',
      `📝 Submission needs revision`, `Your submission for "${bounty.title}" was not approved.`, `/bounties`);
    await safeEmail(
      () => sendBountyRejectedEmail(sub.rows[0].email, sub.rows[0].full_name, bounty.title, reason),
      'bounty_rejected'
    );

    res.json({ success: true });
  } catch (err) {
    console.error('[Bounty] ❌ rejectBounty error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ── DELETE /api/bounties/:id ──────────────────────────────────────────────────
const cancelBounty = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[Bounty] DELETE /${id} – user: ${req.user.id}`);

    const bountyRes = await query(`SELECT * FROM bounties WHERE id = $1`, [id]);
    if (bountyRes.rows.length === 0) return res.status(404).json({ error: 'Bounty not found' });

    const b = bountyRes.rows[0];
    if (b.requester_id !== req.user.id && req.user.role !== 'professor') {
      return res.status(403).json({ error: 'Only the requester can cancel this bounty' });
    }
    if (!['open', 'claimed'].includes(b.status)) {
      return res.status(400).json({ error: 'Cannot cancel a fulfilled or expired bounty' });
    }

    await query(`UPDATE bounties SET status = 'closed' WHERE id = $1`, [id]);
    console.log(`[Bounty] ✅ Bounty ${id} cancelled`);
    res.json({ success: true });
  } catch (err) {
    console.error('[Bounty] ❌ cancelBounty error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  createBounty,
  getBounties,
  getMyBounties,
  claimBounty,
  submitBounty,
  approveBounty,
  rejectBounty,
  cancelBounty,
};
