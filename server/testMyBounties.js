require('dotenv').config();
const { Pool } = require('pg');

const dbUrl = (process.env.DATABASE_URL || '').replace('&channel_binding=require', '').replace('?channel_binding=require', '?');
const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function runTest() {
  const client = await pool.connect();
  let userId;
  try {
    const user = await client.query('SELECT id FROM users LIMIT 1');
    userId = user.rows[0].id;
    
    console.log('Testing getMyBounties with userId:', userId);
    
    await client.query(`SELECT b.*, n.title AS node_title,
              (SELECT COUNT(*) FROM bounty_submissions WHERE bounty_id = b.id) AS submission_count
       FROM bounties b LEFT JOIN syllabus_nodes n ON n.id = b.syllabus_node_id
       WHERE b.requester_id = $1 ORDER BY b.created_at DESC`, [userId]);
    console.log(' -> Created Bounties QUERY OK');

    await client.query(`SELECT b.*, u.full_name AS requester_name, n.title AS node_title,
              bs.status AS submission_status, bs.id AS submission_id
       FROM bounties b
       JOIN users u ON u.id = b.requester_id
       LEFT JOIN syllabus_nodes n ON n.id = b.syllabus_node_id
       LEFT JOIN bounty_submissions bs ON bs.bounty_id = b.id AND bs.fulfiller_id = $1
       WHERE b.claimer_id = $1 OR bs.fulfiller_id = $1
       ORDER BY b.created_at DESC`, [userId]);
    console.log(' -> Claimed Bounties QUERY OK');

  } catch(e) {
    console.error('ERROR:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
}

runTest();
