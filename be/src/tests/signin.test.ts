import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/client/client.js';
import app from '../app.js';
import { prisma } from '../database.js';
import { getConfig, getDatabaseConfig } from '../config.js';
import { signInternalToken } from '../common/internalToken.js';
import { signInUser } from '../service/auth.js';
import { T, cleanupTestData } from './setup.js';

// POST /api/auth/sign-in (#73): the only place users are created.

// ── bootstrap, against a genuinely empty user table ──────────────────────
// A throwaway schema with the real migrations applied, so "first user ever"
// can be tested without touching the shared dev/CI data.
describe('signInUser bootstrap (empty schema)', () => {
  const schema = `bootstrap_${Date.now()}`;
  let db: PrismaClient;

  beforeAll(async () => {
    await prisma.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    const dir = path.join(import.meta.dirname, '../prisma/migrations');
    for (const m of readdirSync(dir).filter((d) => /^\d/.test(d)).sort()) {
      const sql = readFileSync(path.join(dir, m, 'migration.sql'), 'utf8');
      await prisma.$transaction([
        prisma.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`),
        ...sql.split(/;\s*$/m).filter((s) => s.trim()).map((s) => prisma.$executeRawUnsafe(s)),
      ]);
    }
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: getDatabaseConfig().databaseUrl }, { schema }) });
  });

  afterAll(async () => {
    await db.$disconnect();
    await prisma.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  });

  beforeEach(async () => { await db.user.deleteMany(); });

  it('makes the very first user an active admin, and the next one pending', async () => {
    const first = await signInUser(db, { provider: 'google', email: 'first@example.com' }, { allowDev: false });
    expect(first).toMatchObject({ status: 'active', isAdmin: true });
    const second = await signInUser(db, { provider: 'google', email: 'second@example.com' }, { allowDev: false });
    expect(second).toMatchObject({ status: 'pending', isAdmin: false });
  });

  it('gives admin to exactly one of two simultaneous first sign-ins', async () => {
    const results = await Promise.all([
      signInUser(db, { provider: 'google', email: 'a@example.com' }, { allowDev: false }),
      signInUser(db, { provider: 'google', email: 'b@example.com' }, { allowDev: false }),
      signInUser(db, { provider: 'google', email: 'c@example.com' }, { allowDev: false }),
    ]);
    expect(results.filter((r) => r.isAdmin)).toHaveLength(1);
    expect(results.filter((r) => r.status === 'pending')).toHaveLength(2);
    expect(await db.user.count()).toBe(3);
  });
});

// ── the shared database ──────────────────────────────────────────────────

// The shared DB isn't seeded in CI's BE job, so make sure the user table is
// never empty here: otherwise the first sign-in (correctly) becomes admin.
const ensureNotFirstUser = () => prisma.user.create({ data: { email: `${T}already-here@example.com`, status: 'active' } });

describe('signInUser (existing users)', () => {
  beforeAll(async () => { await cleanupTestData(); await ensureNotFirstUser(); });
  afterAll(async () => { await cleanupTestData(); });

  it('creates a new Google user as pending, with allowAutomation off, and lowercases the email', async () => {
    const u = await signInUser(prisma, { provider: 'google', email: `${T}New@Example.com`, name: 'New Person' }, { allowDev: false });
    expect(u).toMatchObject({ email: `${T.toLowerCase()}new@example.com`, status: 'pending', isAdmin: false, name: 'New Person' });
    const row = await prisma.user.findUnique({ where: { id: u.id } });
    expect(row!.allowAutomation).toBe(false);
  });

  it('finds an existing user instead of creating a second row, whatever the case', async () => {
    const existing = await prisma.user.create({ data: { email: `${T}exists@example.com`, status: 'active' } });
    const u = await signInUser(prisma, { provider: 'google', email: `${T}EXISTS@example.com` }, { allowDev: false });
    expect(u.id).toBe(existing.id);
    expect(u.status).toBe('active');
  });

  it('returns pending and denied users as they are (the FE shows the right screen)', async () => {
    await prisma.user.create({ data: { email: `${T}denied@example.com`, status: 'denied' } });
    const u = await signInUser(prisma, { provider: 'google', email: `${T}denied@example.com` }, { allowDev: false });
    expect(u.status).toBe('denied');
  });

  it('dev provider: signs in an existing user, never creates one, and is refused when not allowed', async () => {
    await prisma.user.create({ data: { email: `${T}dev@example.com`, status: 'active' } });
    await expect(signInUser(prisma, { provider: 'dev', email: `${T}dev@example.com` }, { allowDev: true })).resolves.toMatchObject({ status: 'active' });
    await expect(signInUser(prisma, { provider: 'dev', email: `${T}nobody@example.com` }, { allowDev: true })).rejects.toThrow();
    expect(await prisma.user.findUnique({ where: { email: `${T}nobody@example.com` } })).toBeNull();
    await expect(signInUser(prisma, { provider: 'dev', email: `${T}dev@example.com` }, { allowDev: false })).rejects.toThrow();
  });

  it('rejects a malformed email', async () => {
    await expect(signInUser(prisma, { provider: 'google', email: 'not-an-email' }, { allowDev: false })).rejects.toThrow();
  });
});

describe('POST /api/auth/sign-in', () => {
  const service = async () => ({ Authorization: `Bearer ${await signInternalToken({ kind: 'service' }, getConfig().internalApiSecret)}` });
  const siteverify = (body: object) =>
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } }));
  const testKeyOk = { success: true, hostname: 'example.com', 'error-codes': [], metadata: { result_with_testing_key: true } };

  beforeAll(async () => { await cleanupTestData(); await ensureNotFirstUser(); });
  afterAll(async () => { await cleanupTestData(); vi.restoreAllMocks(); });

  it('creates a pending user for the FE service with a good Turnstile token', async () => {
    siteverify(testKeyOk);
    const res = await request(app).post('/api/auth/sign-in').set(await service())
      .send({ provider: 'google', email: `${T}route@example.com`, name: 'Route', turnstileToken: 'tok' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'pending', isAdmin: false });
    expect(res.body.data).not.toHaveProperty('allowAutomation');
  });

  it('401s without a service token, even with an active user identity', async () => {
    siteverify(testKeyOk);
    const user = await prisma.user.create({ data: { email: `${T}caller@example.com`, status: 'active' } });
    const userToken = await signInternalToken({ kind: 'user', userId: user.id }, getConfig().internalApiSecret);
    for (const headers of [{}, { Authorization: `Bearer ${userToken}` }, { 'x-user-email': user.email }]) {
      const res = await request(app).post('/api/auth/sign-in').set(headers)
        .send({ provider: 'google', email: `${T}x@example.com`, turnstileToken: 'tok' });
      expect(res.status).toBe(401);
    }
  });

  it('401s when Turnstile fails, and creates nothing', async () => {
    siteverify({ success: false, 'error-codes': ['invalid-input-response'] });
    const res = await request(app).post('/api/auth/sign-in').set(await service())
      .send({ provider: 'google', email: `${T}bot@example.com`, turnstileToken: 'tok' });
    expect(res.status).toBe(401);
    expect(await prisma.user.findUnique({ where: { email: `${T}bot@example.com` } })).toBeNull();
  });

  it('406s an unknown provider', async () => {
    siteverify(testKeyOk);
    const res = await request(app).post('/api/auth/sign-in').set(await service())
      .send({ provider: 'github', email: `${T}gh@example.com`, turnstileToken: 'tok' });
    expect(res.status).toBe(406);
  });
});
