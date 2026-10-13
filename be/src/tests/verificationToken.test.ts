import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../database.js';
import { getConfig } from '../config.js';
import { signInternalToken } from '../common/internalToken.js';
import { cleanupTestData } from './setup.js';

// Magic-link tokens (#74): Auth.js's adapter stores them in the BE. FE only
// (service token). Auth.js hashes the token before it gets here.
const ID = '_test_vt@example.com';
const service = async () => ({ Authorization: `Bearer ${await signInternalToken({ kind: 'service' }, getConfig().internalApiSecret)}` });
const inMinutes = (m: number) => new Date(Date.now() + m * 60_000).toISOString();

beforeAll(async () => { await cleanupTestData(); });
afterAll(async () => { await prisma.verification_token.deleteMany({ where: { identifier: { startsWith: '_test_' } } }); await cleanupTestData(); });

describe('POST /api/auth/verification-token', () => {
  it('stores a token for the FE service', async () => {
    const res = await request(app).post('/api/auth/verification-token').set(await service())
      .send({ identifier: ID, token: 'hash-1', expires: inMinutes(15) });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ identifier: ID, token: 'hash-1' });
  });

  it('401s without a service token, even for an active user', async () => {
    const user = await prisma.user.create({ data: { email: '_TEST_vt-user@example.com', status: 'active' } });
    const userToken = await signInternalToken({ kind: 'user', userId: user.id }, getConfig().internalApiSecret);
    for (const headers of [{}, { Authorization: `Bearer ${userToken}` }, { 'x-user-email': user.email }]) {
      const res = await request(app).post('/api/auth/verification-token').set(headers).send({ identifier: ID, token: 'x', expires: inMinutes(15) });
      expect(res.status).toBe(401);
    }
  });

  it('406s a malformed body', async () => {
    for (const body of [{ token: 't', expires: inMinutes(15) }, { identifier: ID, expires: inMinutes(15) }, { identifier: ID, token: 't', expires: 'soon' }, { identifier: ID, token: 't', expires: inMinutes(15), extra: 1 }]) {
      expect((await request(app).post('/api/auth/verification-token').set(await service()).send(body)).status, JSON.stringify(body)).toBe(406);
    }
  });
});

describe('POST /api/auth/verification-token/use', () => {
  it('returns the token once and deletes it: a link works exactly once', async () => {
    await request(app).post('/api/auth/verification-token').set(await service()).send({ identifier: ID, token: 'hash-once', expires: inMinutes(15) });
    const first = await request(app).post('/api/auth/verification-token/use').set(await service()).send({ identifier: ID, token: 'hash-once' });
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({ identifier: ID, token: 'hash-once' });
    const second = await request(app).post('/api/auth/verification-token/use').set(await service()).send({ identifier: ID, token: 'hash-once' });
    expect(second.status).toBe(200);
    expect(second.body.data).toBeNull();
  });

  it('returns null for an unknown token, and for an expired one (which it also removes)', async () => {
    const unknown = await request(app).post('/api/auth/verification-token/use').set(await service()).send({ identifier: ID, token: 'never-issued' });
    expect(unknown.body.data).toBeNull();
    await prisma.verification_token.create({ data: { identifier: ID, token: 'hash-old', expires: new Date(Date.now() - 1000) } });
    const expired = await request(app).post('/api/auth/verification-token/use').set(await service()).send({ identifier: ID, token: 'hash-old' });
    expect(expired.body.data).toBeNull();
    expect(await prisma.verification_token.findUnique({ where: { identifier_token: { identifier: ID, token: 'hash-old' } } })).toBeNull();
  });

  it('only matches the token issued for that identifier', async () => {
    await request(app).post('/api/auth/verification-token').set(await service()).send({ identifier: ID, token: 'hash-mine', expires: inMinutes(15) });
    const res = await request(app).post('/api/auth/verification-token/use').set(await service()).send({ identifier: '_test_other@example.com', token: 'hash-mine' });
    expect(res.body.data).toBeNull();
  });

  it('401s without a service token', async () => {
    expect((await request(app).post('/api/auth/verification-token/use').send({ identifier: ID, token: 'x' })).status).toBe(401);
  });
});
