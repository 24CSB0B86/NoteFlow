'use strict';

const { query } = require('../config/db');
const { sendNotificationEmail } = require('./emailService');

// ── Karma Points Table ─────────────────────────────────────────────────────────
const KARMA_POINTS = {
  upload:              10,
  upvote:               2,
  downvote:            -1,
  bounty_fulfill:      20,
  bounty_create:        0,
  discussion_helpful:   5,
  login_streak:         1,
  professor_verify:    15,
  spam_penalty:       -50,
  badge_bonus:          0,
  manual_adjustment:    0,
};

// ── Level Thresholds ──────────────────────────────────────────────────────────
const LEVELS = [
  { level: 1, name: 'Novice',      min: 0,    max: 100  },
  { level: 2, name: 'Contributor', min: 101,  max: 300  },
  { level: 3, name: 'Expert',      min: 301,  max: 600  },
  { level: 4, name: 'Master',      min: 601,  max: 1000 },
  { level: 5, name: 'Legend',      min: 1001, max: Infinity },
];

// ── Badge Criteria Checkers ───────────────────────────────────────────────────
const BADGE_CHECKERS = {
  upload_count: async (userId) => {
    const r = await query(`SELECT COUNT(*) AS cnt FROM resources WHERE uploader_id = $1 AND is_deleted = FALSE`, [userId]);
    return parseInt(r.rows[0].cnt);
  },
  bounty_fulfill: async (userId) => {
    const r = await query(`SELECT COUNT(*) AS cnt FROM bounty_submissions WHERE fulfiller_id = $1 AND status = 'approved'`, [userId]);
    return parseInt(r.rows[0].cnt);
  },
  verified_resource: async (userId) => {
    const r = await query(`SELECT COUNT(*) AS cnt FROM resources WHERE uploader_id = $1 AND is_verified = TRUE`, [userId]);
    return parseInt(r.rows[0].cnt);
  },
  upvotes_received: async (userId) => {
    const r = await query(
      `SELECT COALESCE(SUM(points),0) AS total FROM karma_transactions
       WHERE user_id = $1 AND action_type = 'upvote'`,
      [userId]
    );
    return parseInt(r.rows[0].total);
  },
  helpful_discussions: async (userId) => {
    const r = await query(`SELECT COUNT(*) AS cnt FROM discussions WHERE user_id = $1 AND is_helpful = TRUE AND is_deleted = FALSE`, [userId]);
    return parseInt(r.rows[0].cnt);
  },
  login_streak: async (userId) => {
    const r = await query(`SELECT login_streak FROM user_karma WHERE user_id = $1`, [userId]);
    return r.rows[0]?.login_streak || 0;
  },
  level: async (userId) => {
    const r = await query(`SELECT level FROM user_karma WHERE user_id = $1`, [userId]);
    return r.rows[0]?.level || 1;
  },
};

// ── Get Level Info from Points ────────────────────────────────────────────────
function getLevelInfo(points) {
  const current = LEVELS.slice().reverse().find(l => points >= l.min) || LEVELS[0];
  const next = LEVELS.find(l => l.level === current.level + 1);
  const progressPct = next
    ? Math.round(((points - current.min) / (next.min - current.min)) * 100)
    : 100;
  return {
    level: current.level,
    levelName: current.name,
    currentMin: current.min,
    nextMin: next?.min ?? null,
    pointsToNext: next ? Math.max(0, next.min - points) : 0,
    progressPct,
  };
}

// ── Ensure user_karma row exists ──────────────────────────────────────────────
async function ensureKarmaRow(userId) {
  await query(
    `INSERT INTO user_karma (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
}

// ── Award Karma (main entry point) ────────────────────────────────────────────
async function awardKarma(userId, actionType, referenceId = null, description = null) {
  const points = KARMA_POINTS[actionType] ?? 0;
  console.log(`[KarmaEngine] awardKarma – user: ${userId} action: ${actionType} points: ${points > 0 ? '+' : ''}${points}`);

  await ensureKarmaRow(userId);

  // Record transaction
  await query(
    `INSERT INTO karma_transactions (user_id, points, action_type, reference_id, description)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, points, actionType, referenceId, description]
  );

  // Update total and recalculate level
  const updated = await query(
    `UPDATE user_karma
     SET total_points = GREATEST(0, total_points + $1)
     WHERE user_id = $2
     RETURNING total_points`,
    [points, userId]
  );

  const newPoints = updated.rows[0]?.total_points ?? 0;
  const { level } = getLevelInfo(newPoints);

  const prevLevelRes = await query(`SELECT level FROM user_karma WHERE user_id = $1`, [userId]);
  const prevLevel = prevLevelRes.rows[0]?.level ?? 1;

  await query(`UPDATE user_karma SET level = $1 WHERE user_id = $2`, [level, userId]);

  // Check and award badges
  const newBadges = await checkAndAwardBadges(userId);

  const leveledUp = level > prevLevel;
  if (leveledUp) console.log(`[KarmaEngine] 🎉 Level up! user: ${userId} ${prevLevel} → ${level}`);
  if (newBadges.length > 0) console.log(`[KarmaEngine] 🏅 New badges for user ${userId}:`, newBadges.map(b => b.name));
  console.log(`[KarmaEngine] ✅ awardKarma done – user: ${userId} newTotal: ${newPoints} level: ${level}`);

  return {
    pointsAwarded: points,
    newTotal: newPoints,
    level,
    leveledUp,
    newBadges,
  };
}

// ── Check and Award All Eligible Badges ──────────────────────────────────────
async function checkAndAwardBadges(userId) {
  const allBadges = await query(`SELECT * FROM badges`);
  const earnedRes = await query(`SELECT badge_id FROM user_badges WHERE user_id = $1`, [userId]);
  const alreadyEarned = new Set(earnedRes.rows.map(r => r.badge_id));

  const newlyEarned = [];

  for (const badge of allBadges.rows) {
    if (alreadyEarned.has(badge.id)) continue;

    const criteria = badge.criteria;
    const checker = BADGE_CHECKERS[criteria.type];
    if (!checker) continue;

    const value = await checker(userId);
    if (value >= criteria.threshold) {
      console.log(`[KarmaEngine] 🏅 Awarding badge "${badge.name}" to user ${userId} (value: ${value} >= threshold: ${criteria.threshold})`);
      await query(
        `INSERT INTO user_badges (user_id, badge_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [userId, badge.id]
      );
      newlyEarned.push(badge);

      // Create in-app notification for badge
      await createNotification(userId, 'badge_earned',
        `🏅 Badge Unlocked: ${badge.name}`,
        badge.description,
        '/profile'
      );
    }
  }

  return newlyEarned;
}

// ── Login Streak Logic ────────────────────────────────────────────────────────
async function recordLoginStreak(userId) {
  await ensureKarmaRow(userId);
  const today = new Date().toISOString().split('T')[0];
  console.log(`[KarmaEngine] recordLoginStreak – user: ${userId} today: ${today}`);

  const res = await query(`SELECT last_login, login_streak FROM user_karma WHERE user_id = $1`, [userId]);
  const { last_login, login_streak } = res.rows[0] || {};

  const lastDate = last_login ? new Date(last_login).toISOString().split('T')[0] : null;
  if (lastDate === today) {
    console.log(`[KarmaEngine] Login streak already recorded today for user ${userId}`);
    return { streakUpdated: false, streak: login_streak };
  }

  const yesterday = new Date(Date.now() - 864e5).toISOString().split('T')[0];
  const newStreak = lastDate === yesterday ? (login_streak || 0) + 1 : 1;
  console.log(`[KarmaEngine] ✅ Streak updated – user: ${userId} streak: ${newStreak} (was: ${login_streak})`);

  await query(
    `UPDATE user_karma SET last_login = $1, login_streak = $2 WHERE user_id = $3`,
    [today, newStreak, userId]
  );

  // Award streak karma
  const result = await awardKarma(userId, 'login_streak', null, `Day ${newStreak} login streak`);
  return { streakUpdated: true, streak: newStreak, ...result };
}

// ── Create In-App Notification ────────────────────────────────────────────────
async function createNotification(userId, type, title, message, link = null) {
  console.log(`[KarmaEngine] createNotification – user: ${userId} type: ${type} title: "${title}"`);
  await query(
    `INSERT INTO notifications (user_id, type, title, message, link)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, type, title, message, link]
  );

  // Optionally fire email for important notifications
  try {
    const user = await query(`SELECT email, full_name FROM users WHERE id = $1`, [userId]);
    if (user.rows[0] && ['badge_earned', 'bounty_approved', 'professor_verify'].includes(type)) {
      await sendNotificationEmail(user.rows[0].email, user.rows[0].full_name, title, message);
    }
  } catch (e) {
    console.warn('[KarmaEngine] Email notification failed (non-fatal):', e.message);
  }
}

module.exports = {
  awardKarma,
  getLevelInfo,
  checkAndAwardBadges,
  recordLoginStreak,
  createNotification,
  ensureKarmaRow,
  KARMA_POINTS,
  LEVELS,
};
