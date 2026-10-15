import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../database.js';
import { getConfig } from '../config.js';
import { T, cleanupTestData, authHeader, createTestAdmin } from './setup.js';

// Admin back office (#90): action-item counts and workload health.
let admin: { id: string; email: string };
let member: { id: string; email: string };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const mailerReplies = (reply: () => Promise<Response>) => vi.spyOn(globalThis, 'fetch').mockImplementation(reply);

beforeAll(async () => {
  await cleanupTestData();
  admin = await createTestAdmin('admin-office');
  member = await prisma.user.create({ data: { email: `${T}admin-member@example.com`, status: 'active' } });
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => { await cleanupTestData(); });

describe.each([['/api/admin/summary'], ['/api/admin/health']])('%s access', (path) => {
  it('401s with no identity', async () => {
    expect((await request(app).get(path)).status).toBe(401);
  });

  it('403s a non-admin', async () => {
    expect((await request(app).get(path).set(authHeader(member.email))).status).toBe(403);
  });
});

describe('GET /api/admin/summary', () => {
  it('counts pending users and owners with no linked user', async () => {
    const before = (await request(app).get('/api/admin/summary').set(authHeader(admin.email))).body.data;
    await prisma.user.create({ data: { email: `${T}summary-pending@example.com`, status: 'pending' } });
    await prisma.user.create({ data: { email: `${T}summary-denied@example.com`, status: 'denied' } });
    await prisma.owner.create({ data: { name: `${T}Unlinked Owner` } });
    await prisma.owner.create({ data: { name: `${T}Linked Owner`, userId: member.id } });

    const res = await request(app).get('/api/admin/summary').set(authHeader(admin.email));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe(200);
    expect(res.body.data).toEqual({
      pendingUsers: before.pendingUsers + 1,
      unlinkedOwners: before.unlinkedOwners + 1,
    });
  });

  // The header badge calls this on every render: it must not wait on the mailer.
  it('never calls the mailer', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch');
    await request(app).get('/api/admin/summary').set(authHeader(admin.email));
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('GET /api/admin/health', () => {
  const health = () => request(app).get('/api/admin/health').set(authHeader(admin.email));

  it('reports be, db and mailer up, with versions', async () => {
    mailerReplies(async () => json({ data: { status: 'ok', version: 'v0.9.0', mode: 'log' }, message: 'ok', status: 200 }));
    const res = await health();
    expect(res.status).toBe(200);
    expect(res.body.data.be).toMatchObject({ status: 'up', version: getConfig().version });
    expect(res.body.data.be.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(res.body.data.db.status).toBe('up');
    expect(res.body.data.db.latencyMs).toBeGreaterThanOrEqual(0);
    expect(res.body.data.mailer).toMatchObject({ status: 'up', version: 'v0.9.0', mode: 'log' });
  });

  it('asks the mailer at its /health, with a timeout', async () => {
    const fetch = mailerReplies(async () => json({ data: { status: 'ok', version: 'dev', mode: 'log' } }));
    await health();
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0]!;
    expect(String(url)).toBe(`${getConfig().mailer!.url}/health`);
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  // A revoked Gmail grant: the mailer answers 503 but still says who it is.
  it('marks a 503 mailer down, keeping its version, and still answers 200', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mailerReplies(async () => json({ data: { status: 'unhealthy', version: 'v0.9.0', mode: 'gmail' }, message: 'unhealthy', status: 503 }, 503));
    const res = await health();
    expect(res.status).toBe(200);
    expect(res.body.data.mailer).toMatchObject({ status: 'down', detail: 'unhealthy', version: 'v0.9.0', mode: 'gmail' });
    expect(res.body.data.db.status).toBe('up');
    expect(warn).toHaveBeenCalledWith('admin', 'health', 'mailer', 503);
  });

  it('marks a hung mailer down by error name', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mailerReplies(async () => { throw new DOMException('The operation was aborted due to timeout', 'TimeoutError'); });
    const res = await health();
    expect(res.status).toBe(200);
    expect(res.body.data.mailer).toEqual({ status: 'down', detail: 'TimeoutError' });
    expect(warn).toHaveBeenCalledWith('admin', 'health', 'mailer', 'TimeoutError');
  });

  it('says not configured when there is no mailer, without calling out', async () => {
    const config = getConfig();
    const { mailer } = config;
    const fetch = vi.spyOn(globalThis, 'fetch');
    config.mailer = undefined;
    try {
      const res = await health();
      expect(res.status).toBe(200);
      expect(res.body.data.mailer).toEqual({ status: 'not configured' });
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      config.mailer = mailer;
    }
  });

  // Only the error's name is logged: a Prisma message can carry the connection string.
  it('marks the db down on a query error, and still answers 200', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mailerReplies(async () => json({ data: { status: 'ok', version: 'dev', mode: 'log' } }));
    vi.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(Object.assign(new Error('postgres://user:pw@host/db refused'), { name: 'PrismaClientInitializationError' }));
    const res = await health();
    expect(res.status).toBe(200);
    expect(res.body.data.db).toEqual({ status: 'down', detail: 'PrismaClientInitializationError' });
    expect(res.body.data.be.status).toBe('up');
    expect(warn).toHaveBeenCalledWith('admin', 'health', 'db', 'PrismaClientInitializationError');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('pw@');
  });
});
