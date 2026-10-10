import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../database.js';
import { getConfig } from '../config.js';
import { signInternalToken } from '../common/internalToken.js';
import { T, cleanupTestData, authHeader, createTestAdmin } from './setup.js';

// Admin user management + request-access (#73, #11).
let admin: { id: string; email: string };
let member: { id: string; email: string };

const bearer = async (userId: string) =>
  ({ Authorization: `Bearer ${await signInternalToken({ kind: 'user', userId }, getConfig().internalApiSecret)}` });
const testKeyOk = { success: true, hostname: 'example.com', 'error-codes': [], metadata: { result_with_testing_key: true } };
const siteverify = (body: object) =>
  // A fresh Response per call: a body can only be read once.
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } }));
const newUser = (suffix: string, status: string, extra: object = {}) =>
  prisma.user.create({ data: { email: `${T}${suffix}@example.com`, status, ...extra } });

beforeAll(async () => {
  await cleanupTestData();
  admin = await createTestAdmin('users-admin');
  member = await newUser('users-member', 'active');
});
afterAll(async () => { await cleanupTestData(); vi.restoreAllMocks(); });

describe('GET /api/user', () => {
  it('lists pending users for an admin, without allowAutomation', async () => {
    const p = await newUser('list-pending', 'pending', { allowAutomation: true });
    const res = await request(app).get('/api/user?status=pending').set(authHeader(admin.email));
    expect(res.status).toBe(200);
    const row = res.body.data.find((u: { id: string }) => u.id === p.id);
    expect(row).toMatchObject({ email: p.email, status: 'pending', isAdmin: false });
    expect(row).not.toHaveProperty('allowAutomation');
    expect(res.body.data.every((u: { status: string }) => u.status === 'pending')).toBe(true);
  });

  it('403s a non-admin', async () => {
    expect((await request(app).get('/api/user').set(authHeader(member.email))).status).toBe(403);
  });

  it('406s an unknown status filter', async () => {
    expect((await request(app).get('/api/user?status=bogus').set(authHeader(admin.email))).status).toBe(406);
  });
});

describe('POST /api/user/:id/approve and /deny', () => {
  let target: { id: string };
  beforeEach(async () => { target = await newUser(`target-${Date.now()}-${Math.random()}`, 'pending'); });

  it('approves a pending user', async () => {
    const res = await request(app).post(`/api/user/${target.id}/approve`).set(authHeader(admin.email)).send({});
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: target.id, status: 'active' });
    expect(res.body.data).not.toHaveProperty('allowAutomation');
  });

  it('denies a user, and the denial applies on their very next request', async () => {
    await request(app).post(`/api/user/${target.id}/approve`).set(authHeader(admin.email)).send({});
    expect((await request(app).get('/api/collection').set(await bearer(target.id))).status).toBe(200);
    const res = await request(app).post(`/api/user/${target.id}/deny`).set(authHeader(admin.email)).send({});
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('denied');
    expect((await request(app).get('/api/collection').set(await bearer(target.id))).status).toBe(401);
  });

  it('links an unlinked owner on approve', async () => {
    const owner = await prisma.owner.create({ data: { name: `${T}Owner To Link` } });
    const res = await request(app).post(`/api/user/${target.id}/approve`).set(authHeader(admin.email)).send({ ownerId: owner.id });
    expect(res.status).toBe(200);
    expect((await prisma.owner.findUnique({ where: { id: owner.id } }))!.userId).toBe(target.id);
  });

  it('409s linking an owner that already belongs to someone, and leaves the user pending', async () => {
    const owner = await prisma.owner.create({ data: { name: `${T}Taken Owner`, userId: member.id } });
    const res = await request(app).post(`/api/user/${target.id}/approve`).set(authHeader(admin.email)).send({ ownerId: owner.id });
    expect(res.status).toBe(409);
    expect((await prisma.user.findUnique({ where: { id: target.id } }))!.status).toBe('pending');
  });

  it('406s a body with allowAutomation (or any field not on the allowlist), and changes nothing', async () => {
    for (const body of [{ allowAutomation: true }, { isAdmin: true }, { status: 'active' }]) {
      const res = await request(app).post(`/api/user/${target.id}/approve`).set(authHeader(admin.email)).send(body);
      expect(res.status, JSON.stringify(body)).toBe(406);
    }
    const row = await prisma.user.findUnique({ where: { id: target.id } });
    expect(row).toMatchObject({ status: 'pending', allowAutomation: false, isAdmin: false });
  });

  it('403s a non-admin, 404s an unknown id, 409s changing your own status', async () => {
    expect((await request(app).post(`/api/user/${target.id}/approve`).set(authHeader(member.email)).send({})).status).toBe(403);
    expect((await request(app).post('/api/user/00000000-0000-0000-0000-000000000000/approve').set(authHeader(admin.email)).send({})).status).toBe(404);
    expect((await request(app).post(`/api/user/${admin.id}/deny`).set(authHeader(admin.email)).send({})).status).toBe(409);
  });
});

describe('POST /api/auth/request-access', () => {
  it('moves a denied user back to pending (signed-in, any status, with Turnstile)', async () => {
    siteverify(testKeyOk);
    const denied = await newUser('re-request', 'denied');
    const res = await request(app).post('/api/auth/request-access').set(await bearer(denied.id)).send({ turnstileToken: 'tok' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('pending');
  });

  it('leaves a pending user pending, and 409s an already-active user', async () => {
    siteverify(testKeyOk);
    const pending = await newUser('still-pending', 'pending');
    expect((await request(app).post('/api/auth/request-access').set(await bearer(pending.id)).send({ turnstileToken: 'tok' })).body.data.status).toBe('pending');
    expect((await request(app).post('/api/auth/request-access').set(await bearer(member.id)).send({ turnstileToken: 'tok' })).status).toBe(409);
  });

  it('401s with no signed-in user, or a failed Turnstile check', async () => {
    siteverify(testKeyOk);
    expect((await request(app).post('/api/auth/request-access').send({ turnstileToken: 'tok' })).status).toBe(401);
    siteverify({ success: false, 'error-codes': ['invalid-input-response'] });
    const denied = await newUser('re-request-bot', 'denied');
    const res = await request(app).post('/api/auth/request-access').set(await bearer(denied.id)).send({ turnstileToken: 'tok' });
    expect(res.status).toBe(401);
    expect((await prisma.user.findUnique({ where: { id: denied.id } }))!.status).toBe('denied');
  });
});
