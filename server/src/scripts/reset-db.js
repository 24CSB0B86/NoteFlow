require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function reset() {
  const client = await pool.connect();
  try {
    console.log('\n🗑️  Dropping all NoteFlow tables...\n');

    await client.query(`
      DROP TABLE IF EXISTS resources          CASCADE;
      DROP TABLE IF EXISTS syllabus_nodes     CASCADE;
      DROP TABLE IF EXISTS syllabus           CASCADE;
      DROP TABLE IF EXISTS classroom_members  CASCADE;
      DROP TABLE IF EXISTS classrooms         CASCADE;
      DROP TABLE IF EXISTS users              CASCADE;
      DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
      DROP FUNCTION IF EXISTS update_node_has_resources() CASCADE;
    `);

    console.log('✅ All tables dropped.\n');

    // Re-run migrations
    const migrationsDir = path.join(__dirname, '../../migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      console.log(`▶  Running: ${file}`);
      await client.query(sql);
      console.log(`✅ ${file} done\n`);
    }

    console.log('🎉 Fresh database is ready!\n');
  } catch (err) {
    console.error('❌ Reset failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

reset();
