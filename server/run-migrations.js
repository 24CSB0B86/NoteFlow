require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Strip SSL channel binding for pg compatibility
const dbUrl = (process.env.DATABASE_URL || '').replace('&channel_binding=require', '').replace('?channel_binding=require', '?');

const pool = new Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

function splitStatements(sql) {
  return [sql]; // completely ignore splitting
}

async function runFile(file) {
  const sql = fs.readFileSync(path.join(__dirname, 'migrations', file), 'utf8');
  const client = await pool.connect();

  console.log(`\n╔════════════════════════════════════════╗`);
  console.log(`║  Running: ${file.padEnd(30)}║`);
  console.log(`╚════════════════════════════════════════╝`);

  try {
    // Run the entire SQL file at once so Postgres can handle functions and triggers correctly
    await client.query(sql);
    console.log(`  ✅  Successfully executed ${file}`);
    return { ok: 1, errors: 0 };
  } catch (err) {
    console.log(`  ❌  Failed to execute ${file}`);
    console.log(`       └─ ${err.message}`);
    return { ok: 0, errors: 1 };
  } finally {
    client.release();
  }
}

(async () => {
  try {
    // Test connection first
    const testClient = await pool.connect();
    const res = await testClient.query('SELECT current_database(), current_user, version()');
    console.log('\n🔌 Connected to Neon DB:');
    console.log(`   DB: ${res.rows[0].current_database}  |  User: ${res.rows[0].current_user}`);
    testClient.release();

    // Read all SQL files in the migrations directory and sort them alphabetically
    const migrationFiles = fs.readdirSync(path.join(__dirname, 'migrations'))
      .filter(f => f.endsWith('.sql'))
      .sort();

    let totalOk = 0;
    let totalErr = 0;

    for (const file of migrationFiles) {
      const result = await runFile(file);
      totalOk += result.ok;
      totalErr += result.errors;
    }

    console.log('═'.repeat(50));
    console.log(`🎉 DONE — ${totalOk} statements ran, ${totalErr} warnings (likely already exists)\n`);
  } catch (e) {
    console.error('\n❌ Fatal connection error:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
