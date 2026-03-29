require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function test() {
  const client = await pool.connect();
  try {
    const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
    console.log('TABLES:');
    tables.rows.forEach(r => console.log(' -', r.table_name));

    const bounties = await client.query('SELECT COUNT(*) as cnt FROM bounties');
    console.log('\nBounty count:', bounties.rows[0].cnt);

    const users = await client.query('SELECT id, email, role FROM users LIMIT 5');
    console.log('\nUsers:');
    users.rows.forEach(u => console.log(' -', u.email, '[' + u.role + ']', 'id:', u.id));

    const members = await client.query('SELECT classroom_id, user_id FROM classroom_members LIMIT 5');
    console.log('\nClassroom members:', members.rows.length, 'rows');

    const classrooms = await client.query('SELECT id, name FROM classrooms LIMIT 5');
    console.log('\nClassrooms:');
    classrooms.rows.forEach(c => console.log(' -', c.name, 'id:', c.id));

    const karma = await client.query('SELECT COUNT(*) as cnt FROM user_karma');
    console.log('\nKarma rows:', karma.rows[0].cnt);

    const badges = await client.query('SELECT COUNT(*) as cnt FROM badges');
    console.log('Badges seeded:', badges.rows[0].cnt);

    if (classrooms.rows.length > 0) {
      const cid = classrooms.rows[0].id;
      console.log('\n--- Testing classroom:', classrooms.rows[0].name, '---');

      const students = await client.query(`
        SELECT u.full_name, u.email, u.role,
               COALESCE(uk.total_points, 0) AS karma_points
        FROM classroom_members cm
        JOIN users u ON u.id = cm.user_id
        LEFT JOIN user_karma uk ON uk.user_id = u.id
        WHERE cm.classroom_id = $1
        ORDER BY karma_points DESC
      `, [cid]);
      console.log('\nMembers in classroom:');
      students.rows.forEach(s => console.log(' -', s.full_name, '[' + s.role + ']', 'karma:', s.karma_points));

      const bq = await client.query('SELECT id, title, status, points_reward FROM bounties WHERE classroom_id = $1', [cid]);
      console.log('\nBounties in classroom:', bq.rows.length);
      bq.rows.forEach(b => console.log(' -', b.title, '[' + b.status + ']', b.points_reward + 'pts'));
    }
  } finally {
    client.release();
    await pool.end();
  }
}

test().catch(e => console.error('ERROR:', e.message));
