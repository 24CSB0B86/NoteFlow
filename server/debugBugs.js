require('dotenv').config();
const { Pool } = require('pg');

const dbUrl = (process.env.DATABASE_URL || '').replace('&channel_binding=require', '').replace('?channel_binding=require', '?');
const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function query(text, params) {
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return res;
  } finally {
    client.release();
  }
}

async function runDebugging() {
  console.log('--- STARTING DB QUERY TESTS ---');
  let classroomId = null;
  let userId = null;

  try {
    // Get a valid classroom_id and user_id to test with
    const classRes = await query('SELECT id FROM classrooms LIMIT 1');
    if (classRes.rows.length) classroomId = classRes.rows[0].id;
    
    const userRes = await query('SELECT id FROM users LIMIT 1');
    if (userRes.rows.length) userId = userRes.rows[0].id;

    console.log(`Testing with classroomId: ${classroomId}, userId: ${userId}`);

    // TEST 1: Profile (getUserKarma)
    if (userId) {
      console.log('Test 1: Profile Query');
      try {
        await query(`SELECT
               (SELECT COUNT(*) FROM resources WHERE uploader_id = $1 AND is_deleted = FALSE) AS upload_count,
               (SELECT COUNT(*) FROM bounty_submissions WHERE fulfiller_id = $1 AND status = 'approved') AS bounties_fulfilled,
               (SELECT COALESCE(SUM(points),0) FROM karma_transactions WHERE user_id = $1 AND action_type = 'upvote') AS upvotes_received,
               (SELECT COUNT(*) FROM discussions WHERE user_id = $1 AND is_deleted = FALSE) AS discussion_count`, [userId]);
        console.log('  -> Profile Stats OK');
      } catch (e) { console.error('  -> Profile Stats FAIL:', e.message); }

      try {
        await query(`SELECT uk.*, u.full_name, u.email, u.avatar_url, u.role
             FROM user_karma uk JOIN users u ON u.id = uk.user_id
             WHERE uk.user_id = $1`, [userId]);
        console.log('  -> Profile Karma OK');
      } catch (e) { console.error('  -> Profile Karma FAIL:', e.message); }
    }

    // TEST 2: Analytics Board (getOverview + gets)
    if (classroomId) {
      console.log('\nTest 2: Analytics Board Queries');
      try {
        await query(`SELECT COUNT(*) AS cnt FROM verification_queue vq JOIN resources r ON r.id = vq.resource_id WHERE r.classroom_id = $1 AND vq.status = 'pending'`, [classroomId]);
        console.log('  -> Analytics Overview Verif OK');
      } catch (e) { console.error('  -> Analytics Overview Verif FAIL:', e.message); }

      try {
        await query(
        `SELECT u.id, u.full_name, u.avatar_url, uk.total_points, uk.level,
                COUNT(r.id) AS upload_count
         FROM classroom_members cm
         JOIN users u ON u.id = cm.user_id
         LEFT JOIN user_karma uk ON uk.user_id = u.id
         LEFT JOIN resources r ON r.uploader_id = u.id AND r.classroom_id = $1 AND r.is_deleted = FALSE
         WHERE cm.classroom_id = $1
         GROUP BY u.id, u.full_name, u.avatar_url, uk.total_points, uk.level
         ORDER BY uk.total_points DESC NULLS LAST LIMIT 5`, [classroomId]);
         console.log('  -> Analytics Top Contributors OK');
      } catch(e) { console.error('  -> Analytics Top Contributors FAIL:', e.message); }
      
      try {
        await query(
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
       ORDER BY n.node_type, total_views DESC`, [classroomId]);
       console.log('  -> Analytics Topics OK');
      } catch(e) { console.error('  -> Analytics Topics FAIL:', e.message); }
    }

    // TEST 3: Bounty Board
    if (classroomId) {
      console.log('\nTest 3: Bounty Board Queries');
      try {
        await query(`UPDATE bounties SET status = 'expired' WHERE expires_at < NOW() AND status = 'open'`);
        console.log('  -> Bounty Expire DB OK');
      } catch (e) { console.error('  -> Bounty Expire FAIL:', e.message); }

      try {
        await query(
      `SELECT b.*, u.full_name AS requester_name, u.avatar_url AS requester_avatar,
              n.title AS node_title,
              claimer.full_name AS claimer_name,
              (SELECT COUNT(*) FROM bounty_submissions WHERE bounty_id = b.id) AS submission_count
       FROM bounties b
       JOIN users u ON u.id = b.requester_id
       LEFT JOIN syllabus_nodes n ON n.id = b.syllabus_node_id
       LEFT JOIN users claimer ON claimer.id = b.claimer_id
       WHERE b.classroom_id = $1
       ORDER BY b.is_urgent DESC, b.created_at DESC`, [classroomId]);
       console.log('  -> Bounty List OK');
      } catch (e) { console.error('  -> Bounty List FAIL:', e.message); }
    }

  } catch (err) {
    console.error('Fatal test wrapper error:', err);
  } finally {
    await pool.end();
  }
}

runDebugging();
