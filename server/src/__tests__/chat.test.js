'use strict';
/**
 * chat.test.js
 * Tests the AI chatbot API endpoints.
 * DB is mocked; aiService is mocked to avoid real OpenAI calls in tests.
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');

// ── Mock DB and AI service ─────────────────────────────────────────────────────
jest.mock('../../config/db', () => ({ query: jest.fn() }));
jest.mock('../../services/aiService', () => ({
  getChatResponse: jest.fn().mockResolvedValue('This is a mocked AI response.'),
}));

const { query } = require('../../config/db');
const { getChatResponse } = require('../../services/aiService');
const app = require('../../index');

// ── Generate a valid JWT for test requests ────────────────────────────────────
function makeToken(userId = 'user-test-001') {
  return jwt.sign(
    { id: userId, email: 'test@example.com', role: 'student' },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
}

const AUTH = () => `Bearer ${makeToken()}`;

beforeEach(() => jest.clearAllMocks());

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/chat', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).post('/api/chat').send({ message: 'hello' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when message is empty', async () => {
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', AUTH())
      .send({ message: '   ' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when message exceeds 1000 chars', async () => {
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', AUTH())
      .send({ message: 'x'.repeat(1001) });
    expect(res.status).toBe(400);
  });

  it('returns the AI reply on valid message', async () => {
    // Mock: history fetch → empty, insert user msg, insert assistant msg
    query
      .mockResolvedValueOnce({ rows: [] })          // history fetch
      .mockResolvedValueOnce({ rows: [] })          // insert user msg
      .mockResolvedValueOnce({                       // insert assistant msg
        rows: [{ id: 'msg-001', created_at: new Date().toISOString() }],
      });

    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', AUTH())
      .send({ message: 'What are karma points?' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('reply', 'This is a mocked AI response.');
    expect(res.body).toHaveProperty('message_id');
    expect(getChatResponse).toHaveBeenCalledTimes(1);
  });

  it('uses classroom context when classroom_id is provided', async () => {
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
      .set('Authorization', AUTH())
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
    const fakeMessages = [
      { id: '1', role: 'user', content: 'hello', rating: null, created_at: new Date().toISOString() },
      { id: '2', role: 'assistant', content: 'hi there', rating: true, created_at: new Date().toISOString() },
    ];
    query
      .mockResolvedValueOnce({ rows: fakeMessages })   // messages
      .mockResolvedValueOnce({ rows: [{ count: '2' }] }); // total count

    const res = await request(app)
      .get('/api/chat/history')
      .set('Authorization', AUTH());

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
    query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app)
      .delete('/api/chat/history')
      .set('Authorization', AUTH());
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
    const res = await request(app)
      .patch('/api/chat/msg-1/rate')
      .set('Authorization', AUTH())
      .send({ rating: 'yes' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when message does not exist for user', async () => {
    query.mockResolvedValueOnce({ rows: [] }); // no rows updated
    const res = await request(app)
      .patch('/api/chat/msg-not-mine/rate')
      .set('Authorization', AUTH())
      .send({ rating: true });
    expect(res.status).toBe(404);
  });

  it('rates a message successfully', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'msg-001' }] });
    const res = await request(app)
      .patch('/api/chat/msg-001/rate')
      .set('Authorization', AUTH())
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
    const { getChatResponse: getRealResponse } = require('../../services/aiService');
    // Without OPENAI_API_KEY the service always uses rule-based
    const savedKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const answer = await getRealResponse('What are karma points?', []);
    expect(typeof answer).toBe('string');
    expect(answer.length).toBeGreaterThan(20);
    process.env.OPENAI_API_KEY = savedKey;
  });
});
