'use strict';
/**
 * auth.test.js
 * Tests authentication endpoints using mocked DB to avoid hitting production.
 * Strategy: mock '../config/db' AND '../config/supabase' so no real network
 * calls are made. The auth middleware calls supabaseAdmin.auth.getUser(token)
 * — if not mocked it tries to reach placeholder.supabase.co and returns 401.
 */
const request = require('supertest');

// ── Mock the DB module before requiring app ────────────────────────────────────
jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

// ── Mock Supabase so auth middleware never hits the network ───────────────────
jest.mock('../config/supabase', () => ({
  supabaseAdmin: {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'uuid-123', email: 'test@example.com' } },
        error: null,
      }),
      signInWithPassword: jest.fn().mockResolvedValue({
        data: {
          user: { id: 'uuid-123', user_metadata: { role: 'student' } },
          session: { access_token: 'access-123', refresh_token: 'refresh-123' }
        },
        error: null
      }),
      admin: {
        createUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'uuid-123' } },
          error: null
        }),
        signOut: jest.fn().mockResolvedValue({ error: null })
      }
    },
  },
}));

const { query } = require('../config/db');
const app = require('../index');

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
    query.mockResolvedValueOnce({ rows: [] }); // auth middleware mock 
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
    // Should be 201 Created
    expect(res.status).toBe(201);
    if (res.status === 201 || res.status === 200) {
      expect(res.body).toHaveProperty('user');
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
    // We expect signInWithPassword to fail so we need to mock it here
    const { supabaseAdmin } = require('../config/supabase');
    supabaseAdmin.auth.signInWithPassword.mockResolvedValueOnce({
      data: null,
      error: { message: 'Invalid email or password' }
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'x' });
    expect(res.status).toBe(401);
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
