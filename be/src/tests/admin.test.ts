import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../database.js';
import { getConfig } from '../config.js';
import { T, cleanupTestData, authHeader, createTestAdmin } from './setup.js';

// Admin back office (#90): what needs doing, and whether every workload is up.
let admin: { email: string };
let member: { email: string };

beforeAll(async () => {
  await cleanupTestData();
  admin = await createTestAdmin('admin-office');
  member = await prisma.user.create({ data: { email: `${T}admin-office-member@example.com`, status: 'active' } });
});
afterEach(() => { vi.restoreAllMocks(); });
afterAll(async () => { await cleanupTestData(); });

describe('GET /api/admin/summary', () => {
  it('counts pending users and owners with no linked user', async () => {
    const before = (await request(app).get('/api/admin/summary').set(authHeader(admin.email))).body.data;
    await prisma.user.create({ data: { email: `${T}summary-pending@example.com`, status: 'pending' } });
    await prisma.user.create({ data: { email: `${T}summary-denied@example.com`, status: 'denied' } });
    await prisma.owner.create({ data: { name: `${T}Summary Unlinked` } });
    const linked = await prisma.user.create({ data: { email: `${T}summary-linked@example.com`, status: 'active' } });
    await prisma.owner.create({ data: { name: `${T}Summary Linked`, userId: linked.id } });

    const res = await request(app).get('/api/admin/summary').set(authHeader(admin.email));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe(200);
    expect(res.body.data).toEqual({ pendingUsers: before.pendingUsers + 1, unlinkedOwners: before.unlinkedOwners + 1 });
  });

  it('403s a non-admin and 401s with no identity', async () => {
    expect((await request(app).get('/api/admin/summary').set(authHeader(member.email))).status).toBe(403);
    expect((await request(app).get('/api/admin/summary')).status).toBe(401);
  });
});

describe('GET /api/admin/health', () => {
  const mailerHealth = (status: number, data: object) =>
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ data, message: 'x', status }), { status, headers: { 'content-type': 'application/json' } }));

  it('reports be, db and mailer up, with versions', async () => {
    const fetchSpy = mailerHealth(200, { status: 'ok', version: 'v9.9.9', mode: 'log' });
    const res = await request(app).get('/api/admin/health').set(authHeader(admin.email));
    expect(res.status).toBe(200);
    expect(res.body.data.be).toMatchObject({ status: 'up', version: getConfig().version });
    expect(typeof res.body.data.be.uptimeSeconds).toBe('number');
    expect(res.body.data.db).toMatchObject({ status: 'up' });
    expect(typeof res.body.data.db.latencyMs).toBe('number');
    expect(res.body.data.mailer).toEqual({ status: 'up', version: 'v9.9.9', mode: 'log' });
    expect(String(fetchSpy.mock.calls[0]![0])).toBe(`${getConfig().mailer!.url}/health`);
  });

  it('marks the mailer down on a 503, keeping its version and mode', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mailerHealth(503, { status: 'unhealthy', version: 'v9.9.9', mode: 'gmail' });
    const res = await request(app).get('/api/admin/health').set(authHeader(admin.email));
    expect(res.status).toBe(200);
    expect(res.body.data.mailer).toEqual({ status: 'down', detail: '503', version: 'v9.9.9', mode: 'gmail' });
    expect(res.body.data.db.status).toBe('up');
    expect(warn).toHaveBeenCalledWith('admin', 'health', 'mailer', 503);
  });

  it('marks the mailer down when it does not answer in time', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new DOMException('The operation timed out.', 'TimeoutError'));
    const res = await request(app).get('/api/admin/health').set(authHeader(admin.email));
    expect(res.status).toBe(200);
    expect(res.body.data.mailer).toEqual({ status: 'down', detail: 'TimeoutError' });
  });

  it('reports the mailer as not configured when MAILER_URL is unset', async () => {
    const config = getConfig();
    const saved = config.mailer;
    delete config.mailer;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    try {
      const res = await request(app).get('/api/admin/health').set(authHeader(admin.email));
      expect(res.status).toBe(200);
      expect(res.body.data.mailer).toEqual({ status: 'not configured' });
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      config.mailer = saved;
    }
  });

  it('marks the db down on a query error, without a 500', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mailerHealth(200, { status: 'ok', version: 'v9.9.9', mode: 'log' });
    vi.spyOn(prisma, '$queryRaw').mockRejectedValue(new Error('connect ECONNREFUSED postgresql://vinyltrack:secret@db'));
    const res = await request(app).get('/api/admin/health').set(authHeader(admin.email));
    expect(res.status).toBe(200);
    expect(res.body.data.db).toEqual({ status: 'down', detail: 'Error' });
    expect(res.body.data.mailer.status).toBe('up');
    // Never the message: a driver error can carry the connection string.
    expect(JSON.stringify(warn.mock.calls)).not.toContain('secret');
  });

  it('403s a non-admin and 401s with no identity', async () => {
    expect((await request(app).get('/api/admin/health').set(authHeader(member.email))).status).toBe(403);
    expect((await request(app).get('/api/admin/health')).status).toBe(401);
  });
});
