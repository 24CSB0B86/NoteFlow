require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('connect', () => {
  console.log('🗄️  Connected to Neon DB (PostgreSQL)');
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
