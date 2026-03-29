'use strict';

const { query } = require('../config/db');
const { getLevelInfo } = require('../services/karmaEngine');

// ── GET /api/karma/:userId ─────────────────────────────────────────────────────
const getUserKarma = async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`[Karma] GET /${userId} – requested by user: ${req.user.id}`);

    // Ensure karma row exists (upsert)
    await query(`INSERT INTO user_karma (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [userId]);

    const [karmaRes, badgesRes, statsRes] = await Promise.all([
      query(`SELECT uk.*, u.full_name, u.email, u.avatar_url, u.role
             FROM user_karma uk JOIN users u ON u.id = uk.user_id
             WHERE uk.user_id = $1`, [userId]),
      query(`SELECT ub.earned_at, b.* FROM user_badges ub JOIN badges b ON b.id = ub.badge_id
             WHERE ub.user_id = $1 ORDER BY ub.earned_at DESC`, [userId]),
      query(`SELECT
               (SELECT COUNT(*) FROM resources WHERE uploader_id = $1 AND is_deleted = FALSE) AS upload_count,
               (SELECT COUNT(*) FROM bounty_submissions WHERE fulfiller_id = $1 AND status = 'approved') AS bounties_fulfilled,
               (SELECT COALESCE(SUM(points),0) FROM karma_transactions WHERE user_id = $1 AND action_type = 'upvote') AS upvotes_received,
               (SELECT COUNT(*) FROM discussions WHERE user_id = $1 AND is_deleted = FALSE) AS discussion_count`, [userId]),
    ]);

    if (karmaRes.rows.length === 0) {
      console.warn(`[Karma] ⚠️ User not found: ${userId}`);
      return res.status(404).json({ error: 'User not found' });
    }

    const karma = karmaRes.rows[0];
    const levelInfo = getLevelInfo(karma.total_points);

    console.log(`[Karma] ✅ Profile loaded – user: ${karma.full_name} points: ${karma.total_points} level: ${karma.level} badges: ${badgesRes.rows.length}`);

    res.json({
      user: {
        id: userId,
        full_name: karma.full_name,
        email: karma.email,
        avatar_url: karma.avatar_url,
        role: karma.role,
      },
      karma: {
        total_points: karma.total_points,
        level: karma.level,
        login_streak: karma.login_streak,
        ...levelInfo,
      },
      badges: badgesRes.rows,
      stats: statsRes.rows[0],
    });
  } catch (err) {
    console.error('[Karma] ❌ getUserKarma error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/karma/leaderboard/:classroomId ────────────────────────────────────
const getLeaderboard = async (req, res) => {
  try {
    const { classroomId } = req.params;
    const { period = 'alltime', limit = 10 } = req.query;
    console.log(`[Karma] GET /leaderboard/${classroomId} – period: ${period} limit: ${limit}`);

    let dateFilter = '';
    const dateParams = [classroomId, parseInt(limit)];
    if (period === 'weekly') {
      dateFilter = `AND kt.created_at >= NOW() - INTERVAL '7 days'`;
    } else if (period === 'monthly') {
      dateFilter = `AND kt.created_at >= NOW() - INTERVAL '30 days'`;
    }

    let boardQuery;
    if (period === 'alltime') {
      boardQuery = await query(
        `SELECT u.id, u.full_name, u.avatar_url, uk.total_points AS points, uk.level, uk.login_streak,
                (SELECT COUNT(*) FROM resources WHERE uploader_id = u.id AND is_deleted = FALSE) AS uploads
         FROM classroom_members cm
         JOIN users u ON u.id = cm.user_id
         LEFT JOIN user_karma uk ON uk.user_id = u.id
         WHERE cm.classroom_id = $1
         UNION
         SELECT u.id, u.full_name, u.avatar_url, uk.total_points AS points, uk.level, uk.login_streak,
                (SELECT COUNT(*) FROM resources WHERE uploader_id = u.id AND is_deleted = FALSE) AS uploads
         FROM classrooms c JOIN users u ON u.id = c.professor_id
         LEFT JOIN user_karma uk ON uk.user_id = u.id
         WHERE c.id = $1
         ORDER BY points DESC NULLS LAST
         LIMIT $2`,
        dateParams
      );
    } else {
      // For weekly/monthly: sum transactions in period for members
      boardQuery = await query(
        `SELECT u.id, u.full_name, u.avatar_url,
                COALESCE(SUM(kt.points),0) AS points,
                uk.level, uk.login_streak,
                (SELECT COUNT(*) FROM resources WHERE uploader_id = u.id AND is_deleted = FALSE) AS uploads
         FROM classroom_members cm
         JOIN users u ON u.id = cm.user_id
         LEFT JOIN karma_transactions kt ON kt.user_id = u.id ${dateFilter}
         LEFT JOIN user_karma uk ON uk.user_id = u.id
         WHERE cm.classroom_id = $1
         GROUP BY u.id, u.full_name, u.avatar_url, uk.level, uk.login_streak
         ORDER BY points DESC
         LIMIT $2`,
        dateParams
      );
    }

    // Get current user rank
    const currentUserRankRes = await query(
      `SELECT rank FROM (
        SELECT u.id, RANK() OVER (ORDER BY uk.total_points DESC NULLS LAST) AS rank
        FROM classroom_members cm JOIN users u ON u.id = cm.user_id
        LEFT JOIN user_karma uk ON uk.user_id = u.id
        WHERE cm.classroom_id = $1
      ) ranked WHERE id = $2`,
      [classroomId, req.user.id]
    );

    console.log(`[Karma] ✅ Leaderboard loaded – ${boardQuery.rows.length} entries, myRank: ${currentUserRankRes.rows[0]?.rank}`);
    res.json({
      leaderboard: boardQuery.rows.map((row, i) => ({ ...row, rank: i + 1 })),
      myRank: currentUserRankRes.rows[0]?.rank || null,
      period,
    });
  } catch (err) {
    console.error('[Karma] ❌ getLeaderboard error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/karma/badges ─────────────────────────────────────────────────────
const getAllBadges = async (req, res) => {
  try {
    console.log(`[Karma] GET /badges – user: ${req.user.id}`);
    const allBadges = await query(`SELECT * FROM badges ORDER BY rarity, name`);
    const earnedRes = await query(
      `SELECT badge_id, earned_at FROM user_badges WHERE user_id = $1`, [req.user.id]
    );
    const earnedMap = Object.fromEntries(earnedRes.rows.map(r => [r.badge_id, r.earned_at]));

    console.log(`[Karma] ✅ Badges loaded – total: ${allBadges.rows.length} earned: ${earnedRes.rows.length}`);
    res.json({
      badges: allBadges.rows.map(b => ({
        ...b,
        earned: !!earnedMap[b.id],
        earned_at: earnedMap[b.id] || null,
      })),
    });
  } catch (err) {
    console.error('[Karma] ❌ getAllBadges error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/karma/activity/:userId ───────────────────────────────────────────
const getActivityLog = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    console.log(`[Karma] GET /activity/${userId} – page: ${page} limit: ${limit}`);

    const result = await query(
      `SELECT * FROM karma_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, parseInt(limit), offset]
    );
    const total = await query(`SELECT COUNT(*) AS cnt FROM karma_transactions WHERE user_id = $1`, [userId]);

    console.log(`[Karma] ✅ Activity log – ${result.rows.length} entries (total: ${total.rows[0].cnt})`);
    res.json({ transactions: result.rows, total: parseInt(total.rows[0].cnt), page: parseInt(page) });
  } catch (err) {
    console.error('[Karma] ❌ getActivityLog error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ── GET /api/karma/notifications ──────────────────────────────────────────────
const getNotifications = async (req, res) => {
  try {
    console.log(`[Karma] GET /notifications – user: ${req.user.id}`);
    const result = await query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30`,
      [req.user.id]
    );
    const unread = await query(
      `SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
      [req.user.id]
    );
    console.log(`[Karma] ✅ Notifications loaded – count: ${result.rows.length} unread: ${unread.rows[0].cnt}`);
    res.json({ notifications: result.rows, unreadCount: parseInt(unread.rows[0].cnt) });
  } catch (err) {
    console.error('[Karma] ❌ getNotifications error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// ── POST /api/karma/notifications/read ───────────────────────────────────────
const markNotificationsRead = async (req, res) => {
  try {
    console.log(`[Karma] POST /notifications/read – user: ${req.user.id}`);
    await query(`UPDATE notifications SET is_read = TRUE WHERE user_id = $1`, [req.user.id]);
    console.log(`[Karma] ✅ All notifications marked as read`);
    res.json({ success: true });
  } catch (err) {
    console.error('[Karma] ❌ markNotificationsRead error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getUserKarma,
  getLeaderboard,
  getAllBadges,
  getActivityLog,
  getNotifications,
  markNotificationsRead,
};
