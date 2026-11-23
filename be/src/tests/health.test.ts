import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { getConfig } from '../config.js';

describe('GET /api/health', () => {
  it('reports ok and the running version, without needing an identity', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
    expect(typeof res.body.data.version).toBe('string');
    expect(res.body.data.version).toBe(getConfig().version);
  });
});

// #134: no "X-Powered-By: Express" on any response, even a 404 or a 401.
describe('X-Powered-By', () => {
  it.each(['/api/health', '/api/nope', '/api/album'])('is never sent (%s)', async (path) => {
    const res = await request(app).get(path);
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
