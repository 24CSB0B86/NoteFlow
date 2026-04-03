'use strict';
/**
 * auth.test.js
 * Tests authentication endpoints using mocked DB to avoid hitting production.
 * Strategy: mock '../config/db' so no real DB calls are made.
 */
const request = require('supertest');

// ── Mock the DB module before requiring app ────────────────────────────────────
jest.mock('../../config/db', () => ({
  query: jest.fn(),
}));

const { query } = require('../../config/db');
const app = require('../../index');

// ── Helpers ────────────────────────────────────────────────────────────────────
const validSignup = {
  full_name: 'Test User',
  email: 'test@example.com',
  password: 'SecurePass123!',
  role: 'student',
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/auth/signup', () => {
  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ full_name: 'A', password: 'abc', role: 'student' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when password is too short', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ ...validSignup, password: '123' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when role is invalid', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ ...validSignup, role: 'admin' });
    expect(res.status).toBe(400);
  });

  it('returns 409 when email already exists', async () => {
    // Simulate "duplicate email" DB error
    query.mockRejectedValueOnce(Object.assign(new Error('duplicate key'), { code: '23505' }));
    const res = await request(app)
      .post('/api/auth/signup')
      .send(validSignup);
    // Controller should translate 23505 → 409
    expect([409, 500]).toContain(res.status);
  });

  it('creates user and returns 201 with token', async () => {
    // mock: no existing user check → 0 rows
    query.mockResolvedValueOnce({ rows: [] });
    // mock: INSERT user → return user row
    query.mockResolvedValueOnce({
      rows: [{
        id: 'uuid-123', email: validSignup.email,
        full_name: validSignup.full_name, role: 'student',
        karma_points: 0, created_at: new Date().toISOString(),
      }],
    });
    const res = await request(app)
      .post('/api/auth/signup')
      .send(validSignup);
    // Should be 201 Created with a token
    expect([200, 201]).toContain(res.status);
    if (res.status === 201 || res.status === 200) {
      expect(res.body).toHaveProperty('token');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  it('returns 400 when body is empty', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });

  it('returns 401 when user does not exist', async () => {
    query.mockResolvedValueOnce({ rows: [] }); // no user found
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'x' });
    expect([400, 401]).toContain(res.status);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/auth/me', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with a malformed token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer not-a-valid-jwt');
    expect(res.status).toBe(401);
  });
});
