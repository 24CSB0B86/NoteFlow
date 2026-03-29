require('dotenv').config();
const { Pool } = require('pg');

const dbUrl = (process.env.DATABASE_URL || '').replace('&channel_binding=require', '').replace('?channel_binding=require', '?');
const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

// Fix script to add missing columns to the `bounties` table
const FIX_SQL = [
  `ALTER TABLE bounties ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE bounties ADD COLUMN IF NOT EXISTS claimer_id UUID REFERENCES users(id) ON DELETE SET NULL`,
  `ALTER TABLE bounties ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ`,
  `ALTER TABLE bounties ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`,

  // To fix checking constraints if previously defined differently
  `ALTER TABLE bounties DROP CONSTRAINT IF EXISTS bounties_status_check`,
  `ALTER TABLE bounties ADD CONSTRAINT bounties_status_check CHECK (status IN ('open','claimed','fulfilled','closed','expired'))`,
];

(async () => {
  const client = await pool.connect();
  let ok = 0;
  console.log('\\n🔧 Patching Bounties Data Model...\\n');
  try {
    for (const stmt of FIX_SQL) {
      try {
        await client.query(stmt);
        console.log(`  ✅  ${stmt.slice(0, 60)}...`);
        ok++;
      } catch (e) {
        console.log(`  ⚠️   Failed: ${e.message}`);
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
  console.log(`\\n🎉 Done — ${ok} applied\\n`);
})();
