import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../database.js';
import { T, cleanupTestData, authHeader, createTestAdmin } from './setup.js';

// `owner` is global and unscoped, like `artist` (see policy.ts): every family
// member's name shows up on copies across collections, so any active user can
// read and write one. Delete is admin-only — removing an owner strips
// attribution from copies other people depend on.

let user: { id: string; email: string };
let other: { id: string; email: string };
let admin: { email: string };

beforeAll(async () => {
  await cleanupTestData();
  user = await prisma.user.create({ data: { email: `${T}owner-user@example.com`, status: 'active' } });
  other = await prisma.user.create({ data: { email: `${T}owner-other@example.com`, status: 'active' } });
  admin = await createTestAdmin('owner-admin');
});
afterAll(async () => { await cleanupTestData(); });

// ── POST /api/owner ───────────────────────────────────────────────────────

describe('POST /api/owner', () => {
  it('creates an owner with no user account at all', async () => {
    const res = await request(app)
      .post('/api/owner')
      .set(authHeader(user.email))
      .send({ name: `${T}Grandma Ruth` });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe(`${T}Grandma Ruth`);
    expect(res.body.data.userId).toBeNull();
  });

  it('creates an owner linked to a user account', async () => {
    const res = await request(app)
      .post('/api/owner')
      .set(authHeader(user.email))
      .send({ name: `${T}Linked`, userId: other.id });
    expect(res.status).toBe(201);
    expect(res.body.data.userId).toBe(other.id);
  });

  it('returns 406 when name is missing', async () => {
    const res = await request(app).post('/api/owner').set(authHeader(user.email)).send({ userId: user.id });
    expect(res.status).toBe(406);
  });

  it('returns 409 for a nonexistent userId', async () => {
    const res = await request(app)
      .post('/api/owner')
      .set(authHeader(user.email))
      .send({ name: `${T}Ghost`, userId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(409);
  });

  // userId is indexed, not unique (#53) — one owner row per account is the
  // rule, and this is the only thing enforcing it.
  it('returns 409 when that user already has an owner row', async () => {
    const taken = await prisma.user.create({ data: { email: `${T}owner-taken@example.com`, status: 'active' } });
    await prisma.owner.create({ data: { name: `${T}First`, userId: taken.id } });
    const res = await request(app)
      .post('/api/owner')
      .set(authHeader(user.email))
      .send({ name: `${T}Second`, userId: taken.id });
    expect(res.status).toBe(409);
  });
});

// ── GET /api/owner ────────────────────────────────────────────────────────

describe('GET /api/owner', () => {
  it('returns 200 with every owner, by name', async () => {
    await prisma.owner.create({ data: { name: `${T}Listed` } });
    const res = await request(app).get('/api/owner').set(authHeader(user.email));
    expect(res.status).toBe(200);
    expect(res.body.data.some((o: { name: string }) => o.name === `${T}Listed`)).toBe(true);
  });

  it('never ships the linked account email', async () => {
    await prisma.owner.create({ data: { name: `${T}HasAccount`, userId: user.id } });
    const res = await request(app).get('/api/owner').set(authHeader(user.email));
    const row = res.body.data.find((o: { name: string }) => o.name === `${T}HasAccount`);
    expect(row).toBeDefined();
    expect(JSON.stringify(row)).not.toContain('@example.com');
  });

  it('returns 401 without an identified user', async () => {
    const res = await request(app).get('/api/owner').set({ 'x-user-email': 'nobody@example.com' });
    expect(res.status).toBe(401);
  });
});

// ── GET /api/owner/:id ────────────────────────────────────────────────────

describe('GET /api/owner/:id', () => {
  it('returns 200 with the owner', async () => {
    const owner = await prisma.owner.create({ data: { name: `${T}ById` } });
    const res = await request(app).get(`/api/owner/${owner.id}`).set(authHeader(user.email));
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(owner.id);
  });

  it('returns 404 with data:null for a nonexistent id', async () => {
    const res = await request(app)
      .get('/api/owner/00000000-0000-0000-0000-000000000000')
      .set(authHeader(user.email));
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
  });
});

// ── PATCH /api/owner/:id ──────────────────────────────────────────────────

describe('PATCH /api/owner/:id', () => {
  it('renames an owner', async () => {
    const owner = await prisma.owner.create({ data: { name: `${T}OldName` } });
    const res = await request(app)
      .patch(`/api/owner/${owner.id}`)
      .set(authHeader(user.email))
      .send({ name: `${T}NewName` });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe(`${T}NewName`);
  });

  it('links an existing owner to an account later on', async () => {
    const late = await prisma.user.create({ data: { email: `${T}owner-late@example.com`, status: 'active' } });
    const owner = await prisma.owner.create({ data: { name: `${T}KidGrewUp` } });
    const res = await request(app)
      .patch(`/api/owner/${owner.id}`)
      .set(authHeader(user.email))
      .send({ userId: late.id });
    expect(res.status).toBe(200);
    expect(res.body.data.userId).toBe(late.id);
  });

  it('returns 409 when linking to a user who already has an owner row', async () => {
    const taken = await prisma.user.create({ data: { email: `${T}owner-taken2@example.com`, status: 'active' } });
    await prisma.owner.create({ data: { name: `${T}AlreadyLinked`, userId: taken.id } });
    const owner = await prisma.owner.create({ data: { name: `${T}WantsSameUser` } });
    const res = await request(app)
      .patch(`/api/owner/${owner.id}`)
      .set(authHeader(user.email))
      .send({ userId: taken.id });
    expect(res.status).toBe(409);
  });

  it('returns 404 for a nonexistent id', async () => {
    const res = await request(app)
      .patch('/api/owner/00000000-0000-0000-0000-000000000000')
      .set(authHeader(user.email))
      .send({ name: `${T}Nope` });
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
  });
});

// ── DELETE /api/owner/:id ─────────────────────────────────────────────────

describe('DELETE /api/owner/:id', () => {
  it('returns 403 for a non-admin', async () => {
    const owner = await prisma.owner.create({ data: { name: `${T}NoDelete` } });
    const res = await request(app).delete(`/api/owner/${owner.id}`).set(authHeader(user.email));
    expect(res.status).toBe(403);
  });

  it('lets an admin delete an owner', async () => {
    const owner = await prisma.owner.create({ data: { name: `${T}AdminDeletes` } });
    const res = await request(app).delete(`/api/owner/${owner.id}`).set(authHeader(admin.email));
    expect(res.status).toBe(200);
    expect(await prisma.owner.findUnique({ where: { id: owner.id } })).toBeNull();
  });

  it('returns 404 for a nonexistent id', async () => {
    const res = await request(app)
      .delete('/api/owner/00000000-0000-0000-0000-000000000000')
      .set(authHeader(admin.email));
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
  });
});
