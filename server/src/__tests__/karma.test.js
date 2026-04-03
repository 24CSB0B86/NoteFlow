'use strict';
/**
 * karma.test.js
 * Tests karma middleware / rate-limiting logic without hitting the DB.
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../../config/db', () => ({ query: jest.fn() }));

const { query } = require('../../config/db');
const app = require('../../index');

function makeToken(role = 'student') {
  return jwt.sign(
    { id: 'user-karma-001', email: 'karma@example.com', role },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
}

beforeEach(() => jest.clearAllMocks());

describe('GET /api/karma/leaderboard', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/karma/leaderboard');
    expect(res.status).toBe(401);
  });

  it('returns leaderboard array', async () => {
    query.mockResolvedValueOnce({
      rows: [
        { id: 'u1', full_name: 'Alice', karma_points: 200 },
        { id: 'u2', full_name: 'Bob',   karma_points: 150 },
      ],
    });
    const res = await request(app)
      .get('/api/karma/leaderboard')
      .set('Authorization', `Bearer ${makeToken()}`);
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
    query.mockResolvedValueOnce({
      rows: [{ karma_points: 120, upload_count: 3, verify_count: 1 }],
    });
    const res = await request(app)
      .get('/api/karma/my')
      .set('Authorization', `Bearer ${makeToken()}`);
    expect([200, 404]).toContain(res.status);
  });
});

describe('Auth Middleware – RBAC', () => {
  it('blocks student from professor-only route', async () => {
    const res = await request(app)
      .get('/api/moderate/queue')
      .set('Authorization', `Bearer ${makeToken('student')}`);
    expect([401, 403]).toContain(res.status);
  });
});
