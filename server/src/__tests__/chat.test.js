'use strict';
/**
 * chat.test.js
 * Tests the AI chatbot API endpoints.
 * DB is mocked; aiService is mocked to avoid real OpenAI calls in tests.
 * Supabase is mocked so auth middleware never hits the network.
 * The auth middleware flow:
 *   1. supabaseAdmin.auth.getUser(token)  → mocked to return fake user
 *   2. query('SELECT ... FROM users WHERE id = $1') → must be first DB mock call
 *   3. actual controller DB calls follow
 */
const request = require('supertest');

// ── Mock DB and AI service ─────────────────────────────────────────────────────
jest.mock('../config/db', () => ({ query: jest.fn() }));
jest.mock('../services/aiService', () => ({
  getChatResponse: jest.fn().mockResolvedValue('This is a mocked AI response.'),
}));

// ── Mock Supabase so auth middleware never hits the network ───────────────────
jest.mock('../config/supabase', () => ({
  supabaseAdmin: {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'user-test-001', email: 'test@example.com' } },
        error: null,
      }),
    },
  },
}));

const { query } = require('../config/db');
const { getChatResponse } = require('../services/aiService');
const app = require('../index');

// ── DB stub for auth middleware's user-profile lookup ─────────────────────────
// The authenticate middleware does: query('SELECT ... FROM users WHERE id=$1')
// This must be the FIRST mock call for every authenticated request.
function stubAuthUser(role = 'student') {
  query.mockResolvedValueOnce({
    rows: [{
      id: 'user-test-001',
      email: 'test@example.com',
      full_name: 'Test User',
      role,
    }],
  });
}

// Use a dummy Bearer token (value doesn't matter — Supabase is mocked)
const FAKE_TOKEN = 'Bearer test-token-chat';

beforeEach(() => jest.clearAllMocks());

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/chat', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).post('/api/chat').send({ message: 'hello' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when message is empty', async () => {
    stubAuthUser();
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', FAKE_TOKEN)
      .send({ message: '   ' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when message exceeds 1000 chars', async () => {
    stubAuthUser();
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', FAKE_TOKEN)
      .send({ message: 'x'.repeat(1001) });
    expect(res.status).toBe(400);
  });

  it('returns the AI reply on valid message', async () => {
    stubAuthUser();
    // Mock: history fetch → empty, insert user msg, insert assistant msg
    query
      .mockResolvedValueOnce({ rows: [] })          // history fetch
      .mockResolvedValueOnce({ rows: [] })          // insert user msg
      .mockResolvedValueOnce({                       // insert assistant msg
        rows: [{ id: 'msg-001', created_at: new Date().toISOString() }],
      });

    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', FAKE_TOKEN)
      .send({ message: 'What are karma points?' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('reply', 'This is a mocked AI response.');
    expect(res.body).toHaveProperty('message_id');
    expect(getChatResponse).toHaveBeenCalledTimes(1);
  });

  it('uses classroom context when classroom_id is provided', async () => {
    stubAuthUser();
    query
      .mockResolvedValueOnce({ rows: [] })           // history
      .mockResolvedValueOnce({                        // classroom context
        rows: [{ classroom_name: 'CS101', code: 'ABC123', resource_count: 5, recent_resources: 'Lecture 1' }],
      })
      .mockResolvedValueOnce({ rows: [] })            // insert user msg
      .mockResolvedValueOnce({
        rows: [{ id: 'msg-002', created_at: new Date().toISOString() }],
      });

    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', FAKE_TOKEN)
      .send({ message: 'What resources are available?', classroom_id: 'uuid-classroom' });

    expect(res.status).toBe(200);
    expect(getChatResponse).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      expect.stringContaining('CS101')
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('GET /api/chat/history', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/chat/history');
    expect(res.status).toBe(401);
  });

  it('returns paginated history array', async () => {
    stubAuthUser();
    const fakeMessages = [
      { id: '1', role: 'user', content: 'hello', rating: null, created_at: new Date().toISOString() },
      { id: '2', role: 'assistant', content: 'hi there', rating: true, created_at: new Date().toISOString() },
    ];
    query
      .mockResolvedValueOnce({ rows: fakeMessages })   // messages
      .mockResolvedValueOnce({ rows: [{ count: '2' }] }); // total count

    const res = await request(app)
      .get('/api/chat/history')
      .set('Authorization', FAKE_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('messages');
    expect(Array.isArray(res.body.messages)).toBe(true);
    expect(res.body.messages).toHaveLength(2);
    expect(res.body).toHaveProperty('total', 2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('DELETE /api/chat/history', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).delete('/api/chat/history');
    expect(res.status).toBe(401);
  });

  it('clears history and returns success', async () => {
    stubAuthUser();
    query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .delete('/api/chat/history')
      .set('Authorization', FAKE_TOKEN);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('PATCH /api/chat/:messageId/rate', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).patch('/api/chat/msg-1/rate').send({ rating: true });
    expect(res.status).toBe(401);
  });

  it('returns 400 when rating is not boolean', async () => {
    stubAuthUser();
    const res = await request(app)
      .patch('/api/chat/msg-1/rate')
      .set('Authorization', FAKE_TOKEN)
      .send({ rating: 'yes' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when message does not exist for user', async () => {
    stubAuthUser();
    query.mockResolvedValueOnce({ rows: [] }); // no rows updated
    const res = await request(app)
      .patch('/api/chat/msg-not-mine/rate')
      .set('Authorization', FAKE_TOKEN)
      .send({ rating: true });
    expect(res.status).toBe(404);
  });

  it('rates a message successfully', async () => {
    stubAuthUser();
    query.mockResolvedValueOnce({ rows: [{ id: 'msg-001' }] });
    const res = await request(app)
      .patch('/api/chat/msg-001/rate')
      .set('Authorization', FAKE_TOKEN)
      .send({ rating: false });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('aiService fallback', () => {
  it('returns a rule-based answer when asked about karma', async () => {
    // Use real aiService (not mocked) to test FAQ rules
    jest.resetModules();
    const { getChatResponse: getRealResponse } = require('../services/aiService');
    // Without OPENAI_API_KEY the service always uses rule-based
    const savedKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const answer = await getRealResponse('What are karma points?', []);
    expect(typeof answer).toBe('string');
    expect(answer.length).toBeGreaterThan(20);
    process.env.OPENAI_API_KEY = savedKey;
  });
});
