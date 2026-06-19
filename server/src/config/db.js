require('dotenv').config();
const { Pool } = require('pg');

// Strip sslmode & channel_binding from the URL — we set SSL explicitly below.
// This prevents pg-connection-string's SSL deprecation warning on startup.
const cleanUrl = (process.env.DATABASE_URL || '')
  .replace(/[?&]sslmode=[^&]*/g, '')
  .replace(/[?&]channel_binding=[^&]*/g, '')
  .replace(/\?&/, '?')   // fix "?&" edge case if sslmode was first param
  .replace(/\?$/, '');   // strip trailing "?" if all params were removed

const pool = new Pool({
  connectionString: cleanUrl,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('🗄️  Database pool error:', err);
});

/**
 * Helper: run a parameterised query and log it to the terminal.
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log(`   🔵 DB query (${duration}ms): ${text.substring(0, 80).replace(/\s+/g, ' ')}…`);
    return res;
  } catch (err) {
    console.error(`   🔴 DB query FAILED: ${text.substring(0, 80).replace(/\s+/g, ' ')}…`);
    console.error(`   🔴 Error: ${err.message}`);
    throw err;
  }
};

module.exports = { pool, query };
