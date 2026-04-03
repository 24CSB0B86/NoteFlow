'use strict';
/**
 * health.test.js
 * Tests the /api/health endpoint and basic server boot.
 * These tests are self-contained — no DB required.
 */
const request = require('supertest');
const app = require('../../index');

describe('GET /api/health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('ai');
  });

  it('rejects unknown routes with 404', async () => {
    const res = await request(app).get('/api/does-not-exist-xyz');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('never exposes stack traces in error responses', async () => {
    const res = await request(app).get('/api/does-not-exist-xyz');
    expect(res.body).not.toHaveProperty('stack');
  });
});
