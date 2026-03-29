require('dotenv').config();
const { Pool } = require('pg');

const dbUrl = (process.env.DATABASE_URL || '').replace('&channel_binding=require', '').replace('?channel_binding=require', '?');
const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

// Fix script: ensures the `enqueue_for_verification` trigger works
// by creating the function first, then the trigger
const FIX_SQL = [
  // Make sure update_updated_at_column exists (may not have been created in earlier migrations)
  `
  CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql
  `,

  // Make sure view_count column exists on resources
  `ALTER TABLE resources ADD COLUMN IF NOT EXISTS view_count INT DEFAULT 0`,

  // Make sure is_deleted exists on resources / discussions
  `ALTER TABLE resources ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE resources ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
  `ALTER TABLE resources ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id) ON DELETE SET NULL`,
  `ALTER TABLE discussions ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE discussions ADD COLUMN IF NOT EXISTS is_helpful BOOLEAN DEFAULT FALSE`,

  // User flags
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_restricted BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS flag_reason TEXT`,

  // enqueue_for_verification function + trigger
  `
  CREATE OR REPLACE FUNCTION enqueue_for_verification()
  RETURNS TRIGGER AS $$
  BEGIN
    INSERT INTO verification_queue (resource_id)
    VALUES (NEW.id)
    ON CONFLICT (resource_id) DO NOTHING;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql
  `,
  `DROP TRIGGER IF EXISTS trg_enqueue_verification ON resources`,
  `
  CREATE TRIGGER trg_enqueue_verification
    AFTER INSERT ON resources
    FOR EACH ROW EXECUTE FUNCTION enqueue_for_verification()
  `,

  // Triggers for updated_at
  `DROP TRIGGER IF EXISTS update_user_karma_updated_at ON user_karma`,
  `
  CREATE TRIGGER update_user_karma_updated_at
    BEFORE UPDATE ON user_karma
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
  `,
  `DROP TRIGGER IF EXISTS update_bounties_updated_at ON bounties`,
  `
  CREATE TRIGGER update_bounties_updated_at
    BEFORE UPDATE ON bounties
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
  `,
];

(async () => {
  const client = await pool.connect();
  let ok = 0, fail = 0;
  console.log('\n🔧 Running fix/patch statements...\n');
  try {
    for (const stmt of FIX_SQL) {
      const preview = stmt.trim().replace(/\s+/g, ' ').slice(0, 72);
      try {
        await client.query(stmt);
        console.log(`  ✅  ${preview}…`);
        ok++;
      } catch (e) {
        console.log(`  ⚠️   ${preview}…`);
        console.log(`       └─ ${e.message.split('\n')[0]}`);
        fail++;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
  console.log(`\n🎉 Done — ${ok} applied, ${fail} skipped\n`);
})();
