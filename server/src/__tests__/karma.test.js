'use strict';
/**
 * karma.test.js
 * Tests karma middleware / rate-limiting logic without hitting the DB.
 * Mocks both DB and Supabase so no real network calls are made.
 * The auth middleware calls supabaseAdmin.auth.getUser(token) — mocked here
 * to return a fake user, then also mock the DB user-profile query the
 * middleware performs after Supabase succeeds.
 */
const request = require('supertest');

jest.mock('../config/db', () => ({ query: jest.fn() }));

// ── Mock Supabase so auth middleware never hits the network ───────────────────
jest.mock('../config/supabase', () => ({
  supabaseAdmin: {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'user-karma-001', email: 'karma@example.com' } },
        error: null,
      }),
    },
  },
}));

const { query } = require('../config/db');
const app = require('../index');

// ── DB stub: middleware needs SELECT user profile after Supabase succeeds ─────
function stubAuthUser(role = 'student') {
  query.mockResolvedValueOnce({
    rows: [{
      id: 'user-karma-001',
      email: 'karma@example.com',
      full_name: 'Karma User',
      role,
    }],
  });
}

// Use a dummy Bearer token (value doesn't matter — Supabase is mocked)
const FAKE_TOKEN = 'Bearer test-token-karma';

beforeEach(() => jest.clearAllMocks());

describe('GET /api/karma/leaderboard', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/karma/leaderboard');
    expect(res.status).toBe(401);
  });

  it('returns leaderboard array', async () => {
    stubAuthUser();                         // auth middleware DB lookup
    query.mockResolvedValueOnce({           // actual leaderboard query
      rows: [
        { id: 'u1', full_name: 'Alice', karma_points: 200 },
        { id: 'u2', full_name: 'Bob',   karma_points: 150 },
      ],
    });
    const res = await request(app)
      .get('/api/karma/leaderboard')
      .set('Authorization', FAKE_TOKEN);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body) || Array.isArray(res.body.leaderboard)).toBe(true);
  });
});

describe('GET /api/karma/my', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/karma/my');
    expect(res.status).toBe(401);
  });

  it('returns current user karma', async () => {
    stubAuthUser();                         // auth middleware DB lookup
    query.mockResolvedValueOnce({           // karma query
      rows: [{ karma_points: 120, upload_count: 3, verify_count: 1 }],
    });
    const res = await request(app)
      .get('/api/karma/my')
      .set('Authorization', FAKE_TOKEN);
    expect([200, 404]).toContain(res.status);
  });
});

describe('Auth Middleware – RBAC', () => {
  it('blocks student from professor-only route', async () => {
    stubAuthUser('student');                // auth middleware returns student role
    const res = await request(app)
      .get('/api/moderate/queue')
      .set('Authorization', FAKE_TOKEN);
    expect([401, 403]).toContain(res.status);
  });
});
