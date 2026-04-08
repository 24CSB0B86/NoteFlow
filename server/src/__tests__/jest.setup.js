'use strict';
/**
 * jest.setup.js
 * Runs before each test file. Loads .env.test if present, otherwise
 * falls back to the regular .env (but overrides DATABASE_URL so tests
 * never accidentally write to production).
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Make sure test suite never touches prod DB
// Set TEST_DATABASE_URL in your environment or CI to point at a test DB.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

// Increase default Jest timeout for network calls
jest.setTimeout(15000);
