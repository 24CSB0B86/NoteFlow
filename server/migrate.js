#!/usr/bin/env node
/**
 * Migration Runner — runs all SQL migrations in order.
 * Safe to run multiple times (all migrations use IF NOT EXISTS / ON CONFLICT).
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function run() {
  const client = await pool.connect();

  try {
    // Create migrations tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Get already applied migrations
    const appliedRes = await client.query(`SELECT filename FROM _migrations ORDER BY id`);
    const applied = new Set(appliedRes.rows.map(r => r.filename));

    // Get all .sql files in order
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`  ⏭️  Already applied: ${file}`);
        continue;
      }

      const sqlPath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(sqlPath, 'utf8');

      try {
        console.log(`  ▶️  Applying: ${file}`);
        await client.query('BEGIN');
        await client.query(sql);
        await client.query(`INSERT INTO _migrations (filename) VALUES ($1)`, [file]);
        await client.query('COMMIT');
        console.log(`  ✅  Applied:  ${file}`);
        ran++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`  ❌  FAILED:   ${file}`);
        console.error(`     Error: ${err.message}`);
        // Continue to next migration instead of crashing
      }
    }

    console.log(`\n🎉 Done! ${ran} migration(s) applied, ${applied.size} already up-to-date.`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Migration runner error:', err.message);
  process.exit(1);
});
