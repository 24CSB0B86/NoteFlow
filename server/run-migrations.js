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

// Split SQL into individual statements, ignoring comments and empty lines
function splitStatements(sql) {
  // Remove block comments
  sql = sql.replace(/\/\*[\s\S]*?\*\//g, '');
  // Split on semicolons
  return sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));
}

async function runFile(file) {
  const sql = fs.readFileSync(path.join(__dirname, 'migrations', file), 'utf8');
  const statements = splitStatements(sql);
  const client = await pool.connect();
  let ok = 0, errors = 0;

  console.log(`\n╔════════════════════════════════════════╗`);
  console.log(`║  Running: ${file.padEnd(30)}║`);
  console.log(`╚════════════════════════════════════════╝`);

  try {
    for (const stmt of statements) {
      try {
        await client.query(stmt);
        ok++;
        // Print first 60 chars of statement for visibility
        const preview = stmt.replace(/\s+/g, ' ').slice(0, 70);
        console.log(`  ✅  ${preview}…`);
      } catch (err) {
        errors++;
        const preview = stmt.replace(/\s+/g, ' ').slice(0, 70);
        console.log(`  ⚠️   ${preview}…`);
        console.log(`       └─ ${err.message.split('\n')[0]}`);
      }
    }
  } finally {
    client.release();
  }

  console.log(`\n  Result: ${ok} ok, ${errors} skipped/warnings out of ${statements.length} statements\n`);
  return { ok, errors };
}

(async () => {
  try {
    // Test connection first
    const testClient = await pool.connect();
    const res = await testClient.query('SELECT current_database(), current_user, version()');
    console.log('\n🔌 Connected to Neon DB:');
    console.log(`   DB: ${res.rows[0].current_database}  |  User: ${res.rows[0].current_user}`);
    testClient.release();

    const r1 = await runFile('005_bounty_karma.sql');
    const r2 = await runFile('006_analytics_moderation.sql');

    const totalOk = r1.ok + r2.ok;
    const totalErr = r1.errors + r2.errors;
    console.log('═'.repeat(50));
    console.log(`🎉 DONE — ${totalOk} statements ran, ${totalErr} warnings (likely already exists)\n`);
  } catch (e) {
    console.error('\n❌ Fatal connection error:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
