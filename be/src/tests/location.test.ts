import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../database.js';
import { T, cleanupTestData, authHeader, createTestAdmin } from './setup.js';

let owner: { id: string; email: string };
let outsider: { email: string };
let admin: { email: string };
let collectionId: string;

beforeAll(async () => {
  await cleanupTestData();
  owner = await prisma.user.create({ data: { email: `${T}loc-owner@example.com`, status: 'active' } });
  outsider = await prisma.user.create({ data: { email: `${T}loc-outsider@example.com`, status: 'active' } });
  admin = await createTestAdmin('loc-admin');
  const collection = await prisma.collection.create({ data: { name: `${T}LocColl`, kind: 'physical', ownerId: owner.id } });
  collectionId = collection.id;
});
afterAll(async () => { await cleanupTestData(); });

// ── POST /api/location ───────────────────────────────────────────────────

describe('POST /api/location', () => {
  it('creates a location with name + kind only', async () => {
    const res = await request(app)
      .post('/api/location')
      .set(authHeader(owner.email))
      .send({ name: `${T}Basement`, kind: 'physical' });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe(`${T}Basement`);
  });

  it('creates a nested location with parentLocationId', async () => {
    const parent = await prisma.location.create({ data: { name: `${T}ParentRoom`, kind: 'physical' } });
    const res = await request(app)
      .post('/api/location')
      .set(authHeader(owner.email))
      .send({ name: `${T}Shelf3`, kind: 'physical', parentLocationId: parent.id });
    expect(res.status).toBe(201);
    expect(res.body.data.parentLocationId).toBe(parent.id);
  });

  it('returns 406 when name is missing', async () => {
    const res = await request(app).post('/api/location').set(authHeader(owner.email)).send({ kind: 'physical' });
    expect(res.status).toBe(406);
  });

  it('returns 406 when kind is missing', async () => {
    const res = await request(app).post('/api/location').set(authHeader(owner.email)).send({ name: `${T}NoKind` });
    expect(res.status).toBe(406);
  });
});

// ── GET /api/location ────────────────────────────────────────────────────

describe('GET /api/location', () => {
  it('returns 200 with an array including resolved parent', async () => {
    const parent = await prisma.location.create({ data: { name: `${T}ListParent`, kind: 'physical' } });
    await prisma.location.create({ data: { name: `${T}ListChild`, kind: 'physical', parentLocationId: parent.id } });
    const res = await request(app).get('/api/location').set(authHeader(owner.email));
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    const child = res.body.data.find((l: { name: string }) => l.name === `${T}ListChild`);
    expect(child.parent.name).toBe(`${T}ListParent`);
  });
});

// ── GET /api/location/:id ────────────────────────────────────────────────

describe('GET /api/location/:id', () => {
  it('returns 200 with location and copies stored directly there', async () => {
    const location = await prisma.location.create({ data: { name: `${T}DirectLoc`, kind: 'physical' } });
    const album = await prisma.album.create({ data: { collectionId, title: `${T}LocAlbum` } });
    await prisma.copy.create({ data: { albumId: album.id, locationId: location.id } });

    const res = await request(app).get(`/api/location/${location.id}`).set(authHeader(owner.email));
    expect(res.status).toBe(200);
    expect(res.body.data.copies).toHaveLength(1);
  });

  it('rolls up copies from child locations', async () => {
    const basement = await prisma.location.create({ data: { name: `${T}RollupBasement`, kind: 'physical' } });
    const shelf = await prisma.location.create({
      data: { name: `${T}RollupShelf`, kind: 'physical', parentLocationId: basement.id },
    });
    const album = await prisma.album.create({ data: { collectionId, title: `${T}RollupAlbum` } });
    await prisma.copy.create({ data: { albumId: album.id, locationId: shelf.id } });

    const res = await request(app).get(`/api/location/${basement.id}`).set(authHeader(owner.email));
    expect(res.status).toBe(200);
    expect(res.body.data.copies).toHaveLength(1);
    expect(res.body.data.copies[0].locationId).toBe(shelf.id);
  });

  it('returns 404 with data:null for a nonexistent id', async () => {
    const res = await request(app)
      .get('/api/location/00000000-0000-0000-0000-000000000000')
      .set(authHeader(owner.email));
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
  });
});

// ── PATCH /api/location/:id ──────────────────────────────────────────────

describe('PATCH /api/location/:id', () => {
  it('updates an unowned location as any active user', async () => {
    const location = await prisma.location.create({ data: { name: `${T}ToUpdate`, kind: 'physical' } });
    const res = await request(app)
      .patch(`/api/location/${location.id}`)
      .set(authHeader(outsider.email))
      .send({ name: `${T}Updated` });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe(`${T}Updated`);
  });

  it('lets the owner update their own location', async () => {
    const location = await prisma.location.create({ data: { name: `${T}OwnedLoc`, kind: 'physical', ownerId: owner.id } });
    const res = await request(app)
      .patch(`/api/location/${location.id}`)
      .set(authHeader(owner.email))
      .send({ name: `${T}OwnedUpdated` });
    expect(res.status).toBe(200);
  });

  it('returns 403 when a non-owner edits an owned location', async () => {
    const location = await prisma.location.create({ data: { name: `${T}NotYours`, kind: 'physical', ownerId: owner.id } });
    const res = await request(app)
      .patch(`/api/location/${location.id}`)
      .set(authHeader(outsider.email))
      .send({ name: `${T}ShouldFail` });
    expect(res.status).toBe(403);
  });

  it('an admin can edit any owned location', async () => {
    const location = await prisma.location.create({ data: { name: `${T}AdminEdit`, kind: 'physical', ownerId: owner.id } });
    const res = await request(app)
      .patch(`/api/location/${location.id}`)
      .set(authHeader(admin.email))
      .send({ name: `${T}AdminEdited` });
    expect(res.status).toBe(200);
  });

  it('returns 404 for a nonexistent id', async () => {
    const res = await request(app)
      .patch('/api/location/00000000-0000-0000-0000-000000000000')
      .set(authHeader(owner.email))
      .send({ name: `${T}Nope` });
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
  });
});

// ── DELETE /api/location/:id ─────────────────────────────────────────────

describe('DELETE /api/location/:id', () => {
  it('deletes an existing location', async () => {
    const location = await prisma.location.create({ data: { name: `${T}ToDelete`, kind: 'physical' } });
    const res = await request(app).delete(`/api/location/${location.id}`).set(authHeader(owner.email));
    expect(res.status).toBe(200);

    const check = await request(app).get(`/api/location/${location.id}`).set(authHeader(owner.email));
    expect(check.status).toBe(404);
  });

  it('returns 403 when a non-owner deletes an owned location', async () => {
    const location = await prisma.location.create({ data: { name: `${T}NotYoursToDelete`, kind: 'physical', ownerId: owner.id } });
    const res = await request(app).delete(`/api/location/${location.id}`).set(authHeader(outsider.email));
    expect(res.status).toBe(403);
  });

  it('returns 404 for a nonexistent id', async () => {
    const res = await request(app)
      .delete('/api/location/00000000-0000-0000-0000-000000000000')
      .set(authHeader(owner.email));
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
  });
});
