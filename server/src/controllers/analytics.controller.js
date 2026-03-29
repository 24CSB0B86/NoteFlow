'use strict';

const { query } = require('../config/db');
const { awardKarma, createNotification } = require('../services/karmaEngine');
const { sendVerificationEmail } = require('../services/emailService');

// ── Helper: Professor check ───────────────────────────────────────────────────
function isProfessor(req, res) {
  if (req.user.role !== 'professor') {
    console.warn(`[Analytics] ⛔ Access denied for user ${req.user.id} (role: ${req.user.role}) – professor required`);
    res.status(403).json({ error: 'Professor access required' });
    return false;
  }
  return true;
}

// ── GET /api/analytics/:classroomId/overview ──────────────────────────────────
const getOverview = async (req, res) => {
  try {
    if (!isProfessor(req, res)) return;
    const { classroomId } = req.params;
    console.log(`[Analytics] GET /overview – classroomId: ${classroomId}`);

    const [students, resources, downloads, pendingVerif, discussions, newUploads, topContributors] = await Promise.all([
      query(`SELECT COUNT(*) AS cnt FROM classroom_members WHERE classroom_id = $1`, [classroomId]),
      query(`SELECT COUNT(*) AS cnt FROM resources WHERE classroom_id = $1 AND is_deleted = FALSE`, [classroomId]),
      query(`SELECT COALESCE(SUM(download_count),0) AS cnt FROM resources WHERE classroom_id = $1 AND is_deleted = FALSE`, [classroomId]),
      query(`SELECT COUNT(*) AS cnt FROM verification_queue vq JOIN resources r ON r.id = vq.resource_id WHERE r.classroom_id = $1 AND vq.status = 'pending'`, [classroomId]),
      query(`SELECT COUNT(*) AS cnt FROM discussions d JOIN resources r ON r.id = d.resource_id WHERE r.classroom_id = $1 AND d.is_deleted = FALSE`, [classroomId]),
      query(`SELECT COUNT(*) AS cnt FROM resources WHERE classroom_id = $1 AND is_deleted = FALSE AND created_at >= NOW() - INTERVAL '7 days'`, [classroomId]),
      query(
        `SELECT u.id, u.full_name, u.avatar_url, uk.total_points, uk.level,
                COUNT(r.id) AS upload_count
         FROM classroom_members cm
         JOIN users u ON u.id = cm.user_id
         LEFT JOIN user_karma uk ON uk.user_id = u.id
         LEFT JOIN resources r ON r.uploader_id = u.id AND r.classroom_id = $1 AND r.is_deleted = FALSE
         WHERE cm.classroom_id = $1
         GROUP BY u.id, u.full_name, u.avatar_url, uk.total_points, uk.level
         ORDER BY uk.total_points DESC NULLS LAST LIMIT 5`,
        [classroomId]
      ),
    ]);

    // Activity feed (last 10 events)
    const activity = await query(
      `SELECT ae.event_type, ae.created_at, ae.metadata,
              u.full_name, r.file_name
       FROM analytics_events ae
       LEFT JOIN users u ON u.id = ae.user_id
       LEFT JOIN resources r ON r.id = ae.resource_id
       WHERE ae.classroom_id = $1
       ORDER BY ae.created_at DESC LIMIT 10`,
      [classroomId]
    );

    const result = {
      kpis: {
        students: parseInt(students.rows[0].cnt),
        resources: parseInt(resources.rows[0].cnt),
        downloads: parseInt(downloads.rows[0].cnt),
        pendingVerifications: parseInt(pendingVerif.rows[0].cnt),
        discussions: parseInt(discussions.rows[0].cnt),
        newUploadsThisWeek: parseInt(newUploads.rows[0].cnt),
      },
      topContributors: topContributors.rows,
      recentActivity: activity.rows,
    };

    console.log(`[Analytics] ✅ Overview loaded – students: ${result.kpis.students}, resources: ${result.kpis.resources}`);
    res.json(result);
  } catch (err) {
    console.error('[Analytics] ❌ getOverview error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/analytics/:classroomId/resources ─────────────────────────────────
const getResourceStats = async (req, res) => {
  try {
    if (!isProfessor(req, res)) return;
    const { classroomId } = req.params;
    const { verified, doc_type, sort = 'views' } = req.query;
    console.log(`[Analytics] GET /resources – classroomId: ${classroomId} sort: ${sort}`);

    let where = `r.classroom_id = $1 AND r.is_deleted = FALSE`;
    const params = [classroomId];
    let idx = 2;

    if (verified !== undefined) { where += ` AND r.is_verified = $${idx++}`; params.push(verified === 'true'); }
    if (doc_type) { where += ` AND fm.doc_type = $${idx++}`; params.push(doc_type); }

    const orderMap = { views: 'r.view_count DESC', downloads: 'r.download_count DESC', newest: 'r.created_at DESC', name: 'r.file_name ASC' };

    const result = await query(
      `SELECT r.id, r.file_name, r.file_type, r.file_size, r.view_count, r.download_count,
              r.is_verified, r.processing_status, r.created_at, r.version,
              u.full_name AS uploader_name,
              fm.doc_type, fm.description,
              n.title AS node_title,
              vq.status AS verification_status,
              fv.thumbnail_path
       FROM resources r
       LEFT JOIN users u ON u.id = r.uploader_id
       LEFT JOIN file_metadata fm ON fm.resource_id = r.id
       LEFT JOIN syllabus_nodes n ON n.id = r.syllabus_node_id
       LEFT JOIN verification_queue vq ON vq.resource_id = r.id
       LEFT JOIN file_versions fv ON fv.resource_id = r.id AND fv.is_current = TRUE
       WHERE ${where}
       ORDER BY ${orderMap[sort] || orderMap.views}`,
      params
    );

    // Upload trend (last 30 days)
    const trend = await query(
      `SELECT DATE(created_at) AS date, COUNT(*) AS count
       FROM resources WHERE classroom_id = $1 AND is_deleted = FALSE
         AND created_at >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(created_at) ORDER BY date`,
      [classroomId]
    );

    // Resource type distribution
    const typeDistrib = await query(
      `SELECT COALESCE(fm.doc_type, 'other') AS type, COUNT(*) AS count
       FROM resources r LEFT JOIN file_metadata fm ON fm.resource_id = r.id
       WHERE r.classroom_id = $1 AND r.is_deleted = FALSE
       GROUP BY COALESCE(fm.doc_type, 'other')`,
      [classroomId]
    );

    console.log(`[Analytics] ✅ Resource stats loaded – ${result.rows.length} resources`);
    res.json({ resources: result.rows, uploadTrend: trend.rows, typeDistribution: typeDistrib.rows });
  } catch (err) {
    console.error('[Analytics] ❌ getResourceStats error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/analytics/:classroomId/students ──────────────────────────────────
const getStudentMetrics = async (req, res) => {
  try {
    if (!isProfessor(req, res)) return;
    const { classroomId } = req.params;
    console.log(`[Analytics] GET /students – classroomId: ${classroomId}`);

    const result = await query(
      `SELECT u.id, u.full_name, u.email, u.avatar_url, u.created_at AS joined_at,
              COALESCE(uk.total_points, 0) AS karma_points, COALESCE(uk.level, 1) AS level,
              COALESCE(uk.login_streak, 0) AS login_streak,
              (SELECT COUNT(*) FROM resources WHERE uploader_id = u.id AND classroom_id = $1 AND is_deleted = FALSE) AS uploads,
              (SELECT COUNT(*) FROM discussions d JOIN resources r ON r.id = d.resource_id
               WHERE d.user_id = u.id AND r.classroom_id = $1 AND d.is_deleted = FALSE) AS discussions,
              (SELECT COUNT(*) FROM bounty_submissions bs JOIN bounties b ON b.id = bs.bounty_id
               WHERE bs.fulfiller_id = u.id AND b.classroom_id = $1 AND bs.status = 'approved') AS bounties_fulfilled,
              (SELECT MAX(ae.created_at) FROM analytics_events ae
               WHERE ae.user_id = u.id AND ae.classroom_id = $1) AS last_active
       FROM classroom_members cm JOIN users u ON u.id = cm.user_id
       LEFT JOIN user_karma uk ON uk.user_id = u.id
       WHERE cm.classroom_id = $1
       ORDER BY karma_points DESC`,
      [classroomId]
    );

    console.log(`[Analytics] ✅ Student metrics loaded – ${result.rows.length} students`);
    res.json({ students: result.rows });
  } catch (err) {
    console.error('[Analytics] ❌ getStudentMetrics error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/analytics/:classroomId/topics ────────────────────────────────────
const getTopicAnalysis = async (req, res) => {
  try {
    if (!isProfessor(req, res)) return;
    const { classroomId } = req.params;
    console.log(`[Analytics] GET /topics – classroomId: ${classroomId}`);

    const result = await query(
      `SELECT n.id, n.title, n.node_type, n.parent_id,
              COUNT(DISTINCT r.id) AS resource_count,
              COALESCE(SUM(r.view_count), 0) AS total_views,
              COALESCE(SUM(r.download_count), 0) AS total_downloads,
              COUNT(DISTINCT b.id) AS bounty_count
       FROM syllabus_nodes n
       JOIN syllabus s ON s.id = n.syllabus_id AND s.classroom_id = $1
       LEFT JOIN resources r ON r.syllabus_node_id = n.id AND r.is_deleted = FALSE
       LEFT JOIN bounties b ON b.syllabus_node_id = n.id
       GROUP BY n.id, n.title, n.node_type, n.parent_id
       ORDER BY n.node_type, total_views DESC`,
      [classroomId]
    );

    const topics = result.rows;
    const gaps = topics.filter(t => t.node_type !== 'unit' && parseInt(t.resource_count) === 0);
    const mostEngaged = [...topics].sort((a, b) => b.total_views - a.total_views).slice(0, 5);

    console.log(`[Analytics] ✅ Topic analysis – ${topics.length} topics, ${gaps.length} gaps`);
    res.json({ topics, gaps, mostEngaged });
  } catch (err) {
    console.error('[Analytics] ❌ getTopicAnalysis error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/analytics/:classroomId/timeline ──────────────────────────────────
const getTimeline = async (req, res) => {
  try {
    if (!isProfessor(req, res)) return;
    const { classroomId } = req.params;
    const { bucket = 'daily', days = 30 } = req.query;
    console.log(`[Analytics] GET /timeline – classroomId: ${classroomId} bucket: ${bucket} days: ${days}`);

    const trunc = bucket === 'weekly' ? 'week' : bucket === 'monthly' ? 'month' : 'day';
    const result = await query(
      `SELECT DATE_TRUNC($1, created_at) AS period, event_type, COUNT(*) AS count
       FROM analytics_events
       WHERE classroom_id = $2 AND created_at >= NOW() - ($3 || ' days')::INTERVAL
       GROUP BY DATE_TRUNC($1, created_at), event_type
       ORDER BY period`,
      [trunc, classroomId, parseInt(days)]
    );

    console.log(`[Analytics] ✅ Timeline loaded – ${result.rows.length} data points`);
    res.json({ timeline: result.rows });
  } catch (err) {
    console.error('[Analytics] ❌ getTimeline error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/analytics/:classroomId/export ────────────────────────────────────
const exportCSV = async (req, res) => {
  try {
    if (!isProfessor(req, res)) return;
    const { classroomId } = req.params;
    const { type = 'resources' } = req.query;
    console.log(`[Analytics] GET /export – classroomId: ${classroomId} type: ${type}`);

    let csvData, headers;
    if (type === 'resources') {
      const r = await query(
        `SELECT r.file_name, r.file_type, r.view_count, r.download_count, r.is_verified, r.created_at,
                u.full_name AS uploader, n.title AS topic
         FROM resources r
         LEFT JOIN users u ON u.id = r.uploader_id
         LEFT JOIN syllabus_nodes n ON n.id = r.syllabus_node_id
         WHERE r.classroom_id = $1 AND r.is_deleted = FALSE`,
        [classroomId]
      );
      headers = ['File Name', 'Type', 'Views', 'Downloads', 'Verified', 'Uploaded At', 'Uploader', 'Topic'];
      csvData = r.rows.map(row => [row.file_name, row.file_type, row.view_count, row.download_count, row.is_verified, row.created_at, row.uploader, row.topic]);
    } else {
      const r = await query(
        `SELECT u.full_name, u.email, COUNT(res.id) AS uploads, COALESCE(uk.total_points,0) AS karma
         FROM classroom_members cm JOIN users u ON u.id = cm.user_id
         LEFT JOIN resources res ON res.uploader_id = u.id AND res.classroom_id = $1
         LEFT JOIN user_karma uk ON uk.user_id = u.id
         WHERE cm.classroom_id = $1 GROUP BY u.id, u.full_name, u.email, uk.total_points`,
        [classroomId]
      );
      headers = ['Name', 'Email', 'Uploads', 'Karma Points'];
      csvData = r.rows.map(row => [row.full_name, row.email, row.uploads, row.karma]);
    }

    const csv = [headers.join(','), ...csvData.map(r => r.map(v => `"${v ?? ''}"`).join(','))].join('\n');
    console.log(`[Analytics] ✅ CSV export ready – ${csvData.length} rows`);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="noteflow-${type}-${classroomId}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('[Analytics] ❌ exportCSV error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ── POST /api/verify/:resourceId ──────────────────────────────────────────────
const verifyResource = async (req, res) => {
  try {
    if (!isProfessor(req, res)) return;
    const { resourceId } = req.params;
    console.log(`[Verify] POST /${resourceId} – professor: ${req.user.id}`);

    const resource = await query(
      `SELECT r.*, u.email, u.full_name FROM resources r JOIN users u ON u.id = r.uploader_id WHERE r.id = $1`,
      [resourceId]
    );
    if (resource.rows.length === 0) {
      console.warn(`[Verify] Resource not found: ${resourceId}`);
      return res.status(404).json({ error: 'Resource not found' });
    }

    const r = resource.rows[0];
    await query(`UPDATE resources SET is_verified = TRUE WHERE id = $1`, [resourceId]);
    await query(
      `UPDATE verification_queue SET status = 'approved', reviewer_id = $1, decision_at = NOW() WHERE resource_id = $2`,
      [req.user.id, resourceId]
    );

    // Log moderation action (using valid CHECK constraint value)
    await query(
      `INSERT INTO moderation_logs (classroom_id, moderator_id, action, target_type, target_id, reason)
       VALUES ($1, $2, 'verify', 'resource', $3, 'Professor verified')`,
      [r.classroom_id, req.user.id, resourceId]
    );

    // Award karma to uploader
    const karmaResult = await awardKarma(r.uploader_id, 'professor_verify', resourceId, `Resource "${r.file_name}" verified`);
    console.log(`[Verify] ✅ Resource verified – karmaAwarded: ${karmaResult.pointsAwarded} to user ${r.uploader_id}`);

    // Notify uploader
    await createNotification(r.uploader_id, 'professor_verify',
      '✅ Resource verified!', `"${r.file_name}" was verified by your professor. +${karmaResult.pointsAwarded} karma!`, '/classrooms');
    try { await sendVerificationEmail(r.email, r.full_name, r.file_name, true); } catch (e) { console.warn('[Verify] Email failed (non-fatal):', e.message); }

    res.json({ success: true, karmaAwarded: karmaResult.pointsAwarded });
  } catch (err) {
    console.error('[Verify] ❌ verifyResource error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ── POST /api/verify/:resourceId/reject ───────────────────────────────────────
const rejectVerification = async (req, res) => {
  try {
    if (!isProfessor(req, res)) return;
    const { resourceId } = req.params;
    const { reason } = req.body;
    console.log(`[Verify] POST /${resourceId}/reject – reason: ${reason}`);

    const resource = await query(
      `SELECT r.*, u.email, u.full_name FROM resources r JOIN users u ON u.id = r.uploader_id WHERE r.id = $1`,
      [resourceId]
    );
    if (resource.rows.length === 0) return res.status(404).json({ error: 'Resource not found' });

    const r = resource.rows[0];
    await query(
      `UPDATE verification_queue SET status = 'rejected', reviewer_id = $1, decision_at = NOW(), reject_reason = $2
       WHERE resource_id = $3`,
      [req.user.id, reason || null, resourceId]
    );

    // Log moderation action (using valid CHECK constraint value)
    await query(
      `INSERT INTO moderation_logs (classroom_id, moderator_id, action, target_type, target_id, reason)
       VALUES ($1, $2, 'reject_resource', 'resource', $3, $4)`,
      [r.classroom_id, req.user.id, resourceId, reason || null]
    );

    console.log(`[Verify] ✅ Resource ${resourceId} rejected – notifying uploader`);
    await createNotification(r.uploader_id, 'verification_rejected',
      '📋 Resource needs revision', `"${r.file_name}" requires changes. Reason: ${reason || 'No reason given'}`, '/classrooms');
    try { await sendVerificationEmail(r.email, r.full_name, r.file_name, false, reason); } catch (e) { console.warn('[Verify] Email failed (non-fatal):', e.message); }

    res.json({ success: true });
  } catch (err) {
    console.error('[Verify] ❌ rejectVerification error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/verify/queue/:classroomId ────────────────────────────────────────
const getVerificationQueue = async (req, res) => {
  try {
    if (!isProfessor(req, res)) return;
    const { classroomId } = req.params;
    console.log(`[Verify] GET /queue/${classroomId}`);

    const result = await query(
      `SELECT vq.id, vq.submitted_at, vq.status, vq.reject_reason,
              r.id AS resource_id, r.file_name, r.file_type, r.file_size, r.created_at,
              u.full_name AS uploader_name, u.email AS uploader_email,
              n.title AS node_title, fv.thumbnail_path
       FROM verification_queue vq
       JOIN resources r ON r.id = vq.resource_id
       JOIN users u ON u.id = r.uploader_id
       LEFT JOIN syllabus_nodes n ON n.id = r.syllabus_node_id
       LEFT JOIN file_versions fv ON fv.resource_id = r.id AND fv.is_current = TRUE
       WHERE r.classroom_id = $1 AND vq.status = 'pending'
       ORDER BY vq.submitted_at ASC`,
      [classroomId]
    );

    console.log(`[Verify] ✅ Queue loaded – ${result.rows.length} pending items`);
    res.json({ queue: result.rows });
  } catch (err) {
    console.error('[Verify] ❌ getVerificationQueue error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ── POST /api/verify/batch ────────────────────────────────────────────────────
const batchVerify = async (req, res) => {
  try {
    if (!isProfessor(req, res)) return;
    const { resourceIds } = req.body;
    if (!Array.isArray(resourceIds) || resourceIds.length === 0) {
      return res.status(400).json({ error: 'resourceIds array required' });
    }
    console.log(`[Verify] POST /batch – verifying ${resourceIds.length} resources`);

    for (const id of resourceIds) {
      await query(`UPDATE resources SET is_verified = TRUE WHERE id = $1`, [id]);
      await query(
        `UPDATE verification_queue SET status = 'approved', reviewer_id = $1, decision_at = NOW() WHERE resource_id = $2`,
        [req.user.id, id]
      );
      console.log(`[Verify] ✅ Batch verified resource: ${id}`);
    }

    res.json({ success: true, verified: resourceIds.length });
  } catch (err) {
    console.error('[Verify] ❌ batchVerify error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ── DELETE /api/moderate/resource/:id ─────────────────────────────────────────
const softDeleteResource = async (req, res) => {
  try {
    if (!isProfessor(req, res)) return;
    const { id } = req.params;
    const { reason } = req.body;
    console.log(`[Moderate] DELETE /resource/${id} – reason: ${reason}`);

    const resource = await query(`SELECT classroom_id FROM resources WHERE id = $1 AND is_deleted = FALSE`, [id]);
    if (resource.rows.length === 0) return res.status(404).json({ error: 'Resource not found' });

    await query(
      `UPDATE resources SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = $1 WHERE id = $2`,
      [req.user.id, id]
    );
    // Using valid CHECK constraint value: 'delete_resource'
    await query(
      `INSERT INTO moderation_logs (classroom_id, moderator_id, action, target_type, target_id, reason)
       VALUES ($1, $2, 'delete_resource', 'resource', $3, $4)`,
      [resource.rows[0].classroom_id, req.user.id, id, reason || null]
    );

    console.log(`[Moderate] ✅ Resource ${id} soft-deleted`);
    res.json({ success: true });
  } catch (err) {
    console.error('[Moderate] ❌ softDeleteResource error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ── POST /api/moderate/user/:id/flag ──────────────────────────────────────────
const flagUser = async (req, res) => {
  try {
    if (!isProfessor(req, res)) return;
    const { id } = req.params;
    const { reason, restrict, penaltyPoints } = req.body;
    console.log(`[Moderate] POST /user/${id}/flag – restrict: ${restrict} penalty: ${penaltyPoints}`);

    await query(`UPDATE users SET is_flagged = TRUE, flag_reason = $1 WHERE id = $2`, [reason || null, id]);
    if (restrict) await query(`UPDATE users SET is_restricted = TRUE WHERE id = $1`, [id]);

    if (penaltyPoints) {
      await awardKarma(id, 'spam_penalty', null, `Moderation: ${reason}`);
    }

    // Note: classroom_id is nullable – omit if not available
    await query(
      `INSERT INTO moderation_logs (moderator_id, action, target_type, target_id, reason)
       VALUES ($1, 'flag_user', 'user', $2, $3)`,
      [req.user.id, id, reason || null]
    );

    console.log(`[Moderate] ✅ User ${id} flagged`);
    res.json({ success: true });
  } catch (err) {
    console.error('[Moderate] ❌ flagUser error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ── DELETE /api/moderate/discussion/:id ───────────────────────────────────────
const deleteDiscussion = async (req, res) => {
  try {
    if (!isProfessor(req, res)) return;
    const { id } = req.params;
    const { reason } = req.body;
    console.log(`[Moderate] DELETE /discussion/${id} – reason: ${reason}`);

    const disc = await query(`SELECT resource_id FROM discussions WHERE id = $1 AND is_deleted = FALSE`, [id]);
    if (disc.rows.length === 0) return res.status(404).json({ error: 'Discussion not found' });

    await query(`UPDATE discussions SET is_deleted = TRUE WHERE id = $1`, [id]);

    const resInfo = await query(`SELECT classroom_id FROM resources WHERE id = $1`, [disc.rows[0].resource_id]);
    const classroomId = resInfo.rows[0]?.classroom_id;

    // Using valid CHECK constraint value: 'delete_discussion'
    await query(
      `INSERT INTO moderation_logs (classroom_id, moderator_id, action, target_type, target_id, reason)
       VALUES ($1, $2, 'delete_discussion', 'discussion', $3, $4)`,
      [classroomId, req.user.id, id, reason || null]
    );

    console.log(`[Moderate] ✅ Discussion ${id} deleted`);
    res.json({ success: true });
  } catch (err) {
    console.error('[Moderate] ❌ deleteDiscussion error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/moderate/logs/:classroomId ───────────────────────────────────────
const getAuditLog = async (req, res) => {
  try {
    if (!isProfessor(req, res)) return;
    const { classroomId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    console.log(`[Moderate] GET /logs/${classroomId} – page: ${page} limit: ${limit}`);

    const result = await query(
      `SELECT ml.*, u.full_name AS moderator_name
       FROM moderation_logs ml JOIN users u ON u.id = ml.moderator_id
       WHERE ml.classroom_id = $1
       ORDER BY ml.created_at DESC LIMIT $2 OFFSET $3`,
      [classroomId, parseInt(limit), offset]
    );
    const total = await query(`SELECT COUNT(*) AS cnt FROM moderation_logs WHERE classroom_id = $1`, [classroomId]);

    console.log(`[Moderate] ✅ Audit log loaded – ${result.rows.length} entries (total: ${total.rows[0].cnt})`);
    res.json({ logs: result.rows, total: parseInt(total.rows[0].cnt) });
  } catch (err) {
    console.error('[Moderate] ❌ getAuditLog error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ── Track Analytics Event (internal helper, also exposed) ─────────────────────
const trackEvent = async (classroomId, userId, eventType, resourceId = null, metadata = {}) => {
  try {
    console.log(`[Analytics] trackEvent – type: ${eventType} user: ${userId} classroom: ${classroomId}`);
    await query(
      `INSERT INTO analytics_events (classroom_id, user_id, event_type, resource_id, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [classroomId, userId, eventType, resourceId, JSON.stringify(metadata)]
    );
  } catch (e) {
    console.warn('[Analytics] ⚠️ trackEvent failed (non-fatal):', e.message);
  }
};

module.exports = {
  getOverview, getResourceStats, getStudentMetrics, getTopicAnalysis,
  getTimeline, exportCSV,
  verifyResource, rejectVerification, getVerificationQueue, batchVerify,
  softDeleteResource, flagUser, deleteDiscussion, getAuditLog,
  trackEvent,
};
