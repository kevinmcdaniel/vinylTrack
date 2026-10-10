import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../database.js';
import { T, cleanupTestData, authHeader } from './setup.js';

// POST /api/collection (#73): an empty production needs a way to start.
let member: { id: string; email: string };

beforeAll(async () => {
  await cleanupTestData();
  member = await prisma.user.create({ data: { email: `${T}coll-create@example.com`, status: 'active' } });
});
afterAll(async () => { await cleanupTestData(); });

describe('POST /api/collection', () => {
  it('creates a collection owned by the caller, and the caller can then see it', async () => {
    const res = await request(app).post('/api/collection').set(authHeader(member.email))
      .send({ name: `${T}New Vinyl`, kind: 'physical', notes: 'first shelf' });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ name: `${T}New Vinyl`, kind: 'physical', notes: 'first shelf', ownerId: member.id, albumCount: 0 });
    const list = await request(app).get('/api/collection').set(authHeader(member.email));
    expect(list.body.data.map((c: { id: string }) => c.id)).toContain(res.body.data.id);
  });

  it.each([
    [{ kind: 'physical' }, 'missing name'],
    [{ name: '   ', kind: 'physical' }, 'blank name'],
    [{ name: `${T}X`, kind: 'cassette' }, 'unknown kind'],
    [{ name: `${T}X`, kind: 'digital', ownerId: '00000000-0000-0000-0000-000000000000' }, 'ownerId (not on the allowlist)'],
  ])('406s %j (%s)', async (body, _why) => {
    expect((await request(app).post('/api/collection').set(authHeader(member.email)).send(body)).status).toBe(406);
  });

  it('401s without a signed-in user', async () => {
    expect((await request(app).post('/api/collection').send({ name: `${T}Anon`, kind: 'digital' })).status).toBe(401);
  });
});
