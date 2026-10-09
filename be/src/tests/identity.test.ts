import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../database.js';
import { getConfig, type Config } from '../config.js';
import { identifyUserWith, requireActiveUser } from '../common/authorize.js';
import { errorHandler } from '../common/errorHandler.js';
import { signInternalToken } from '../common/internalToken.js';
import { T, cleanupTestData, authHeader } from './setup.js';

// identifyUser (#73): the signed FE token is the identity; x-user-email only
// in development/test; nothing presented → no user → 401. No fallback.
let active: { id: string; email: string };
let pending: { id: string };
let denied: { id: string };

const bearer = async (userId: string, secret = getConfig().internalApiSecret) =>
  ({ Authorization: `Bearer ${await signInternalToken({ kind: 'user', userId }, secret)}` });

beforeAll(async () => {
  await cleanupTestData();
  active = await prisma.user.create({ data: { email: `${T}id-active@example.com`, status: 'active' } });
  pending = await prisma.user.create({ data: { email: `${T}id-pending@example.com`, status: 'pending' } });
  denied = await prisma.user.create({ data: { email: `${T}id-denied@example.com`, status: 'denied' } });
});
afterAll(async () => { await cleanupTestData(); });

describe('identity on a protected route (GET /api/collection)', () => {
  it('accepts a valid token for an active user', async () => {
    const res = await request(app).get('/api/collection').set(await bearer(active.id));
    expect(res.status).toBe(200);
  });

  it('401s with nothing presented: there is no fallback identity', async () => {
    const res = await request(app).get('/api/collection');
    expect(res.status).toBe(401);
    expect(res.body.data).toBeNull();
  });

  it('401s for a token signed with the wrong secret', async () => {
    const res = await request(app).get('/api/collection').set(await bearer(active.id, 'z'.repeat(32)));
    expect(res.status).toBe(401);
  });

  it('401s for a token naming an unknown user', async () => {
    const res = await request(app).get('/api/collection').set(await bearer('00000000-0000-0000-0000-000000000000'));
    expect(res.status).toBe(401);
  });

  it('401s for pending and denied users, re-read on every request', async () => {
    expect((await request(app).get('/api/collection').set(await bearer(pending.id))).status).toBe(401);
    expect((await request(app).get('/api/collection').set(await bearer(denied.id))).status).toBe(401);
  });

  it('401s for a service token: it names no user', async () => {
    const token = await signInternalToken({ kind: 'service' }, getConfig().internalApiSecret);
    const res = await request(app).get('/api/collection').set({ Authorization: `Bearer ${token}` });
    expect(res.status).toBe(401);
  });

  it('does not fall back to x-user-email when a bad token is presented', async () => {
    const res = await request(app).get('/api/collection')
      .set({ Authorization: 'Bearer garbage', ...authHeader(active.email) });
    expect(res.status).toBe(401);
  });

  it('still accepts x-user-email in development/test', async () => {
    const res = await request(app).get('/api/collection').set(authHeader(active.email));
    expect(res.status).toBe(200);
  });
});

describe('identity with production config', () => {
  const prodApp = () => {
    const config: Config = { ...getConfig(), appEnv: 'production', devIdentityHeader: false };
    const a = express();
    a.use(identifyUserWith(() => config));
    a.get('/who', requireActiveUser, (req, res) => { res.json({ data: { id: req.user!.id } }); });
    a.use(errorHandler);
    return a;
  };

  it('ignores x-user-email entirely', async () => {
    const res = await request(prodApp()).get('/who').set(authHeader(active.email));
    expect(res.status).toBe(401);
  });

  it('accepts the signed token', async () => {
    const res = await request(prodApp()).get('/who').set(await bearer(active.id));
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(active.id);
  });
});
