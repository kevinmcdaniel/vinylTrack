import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../database.js';
import { T, cleanupTestData, authHeader, createTestAdmin } from './setup.js';

let owner: { id: string; email: string };
let outsider: { id: string; email: string };
let admin: { id: string; email: string };
let collectionId: string;
let albumId: string;
let locationId: string;
let otherLocationId: string;
let foreignLocationId: string;
let sourceId: string;
let ownerId: string;

beforeAll(async () => {
  await cleanupTestData();
  owner = await prisma.user.create({ data: { email: `${T}copy-owner@example.com`, status: 'active' } });
  outsider = await prisma.user.create({ data: { email: `${T}copy-outsider@example.com`, status: 'active' } });
  admin = await createTestAdmin('copy-admin');
  const collection = await prisma.collection.create({ data: { name: `${T}CopyColl`, kind: 'physical', ownerId: owner.id } });
  collectionId = collection.id;
  const album = await prisma.album.create({ data: { collectionId, title: `${T}CopyAlbum` } });
  albumId = album.id;
  const location = await prisma.location.create({ data: { name: `${T}CopyLoc`, kind: 'physical', collectionId } });
  locationId = location.id;
  // Second location in the same collection — where a lent record goes.
  const otherLocation = await prisma.location.create({
    data: { name: `${T}CopyLocMoved`, kind: 'physical', collectionId },
  });
  otherLocationId = otherLocation.id;
  // A location in a different collection: a copy may never straddle the two.
  const foreignCollection = await prisma.collection.create({
    data: { name: `${T}CopyForeignColl`, kind: 'physical', ownerId: owner.id },
  });
  const foreignLocation = await prisma.location.create({
    data: { name: `${T}CopyForeignLoc`, kind: 'physical', collectionId: foreignCollection.id },
  });
  foreignLocationId = foreignLocation.id;
  const ownerRow = await prisma.owner.create({ data: { name: `${T}CopyOwnerRow`, userId: owner.id } });
  ownerId = ownerRow.id;
  const source = await prisma.source.create({ data: { type: 'store', name: `${T}CopyStore` } });
  sourceId = source.id;
});
afterAll(async () => { await cleanupTestData(); });

// ── POST /api/copy ────────────────────────────────────────────────────────

describe('POST /api/copy', () => {
  it('creates a copy with albumId + locationId only', async () => {
    const res = await request(app)
      .post('/api/copy')
      .set(authHeader(owner.email))
      .send({ albumId, locationId, ownerId });
    expect(res.status).toBe(201);
    expect(res.body.data.albumId).toBe(albumId);
    expect(res.body.data.locationId).toBe(locationId);
    expect(res.body.data.ownerId).toBe(ownerId);
  });

  it('creates a copy with source + acquisition fields', async () => {
    const res = await request(app)
      .post('/api/copy')
      .set(authHeader(owner.email))
      .send({ albumId, locationId, ownerId, sourceId, price: 24.99, condition: 'VG+', notes: 'test' });
    expect(res.status).toBe(201);
    expect(res.body.data.sourceId).toBe(sourceId);
    expect(res.body.data.condition).toBe('VG+');
  });

  it('returns 403 for an outsider posting a copy against an album they cannot access', async () => {
    const res = await request(app)
      .post('/api/copy')
      .set(authHeader(outsider.email))
      .send({ albumId, locationId, ownerId });
    expect(res.status).toBe(403);
  });

  it('returns 406 when albumId is missing', async () => {
    const res = await request(app).post('/api/copy').set(authHeader(owner.email)).send({ locationId, ownerId });
    expect(res.status).toBe(406);
  });

  it('returns 406 when locationId is missing', async () => {
    const res = await request(app).post('/api/copy').set(authHeader(owner.email)).send({ albumId, ownerId });
    expect(res.status).toBe(406);
  });

  it('returns 409 for a nonexistent albumId', async () => {
    const res = await request(app)
      .post('/api/copy')
      .set(authHeader(admin.email))
      .send({ albumId: '00000000-0000-0000-0000-000000000000', locationId, ownerId });
    expect(res.status).toBe(409);
  });

  // #53: whose copy this is no longer comes from the location, so it has to be
  // stated. The column is nullable only because it could not be added to a
  // populated table any other way — the API is what makes it required.
  it('returns 406 when ownerId is missing', async () => {
    const res = await request(app).post('/api/copy').set(authHeader(owner.email)).send({ albumId, locationId });
    expect(res.status).toBe(406);
  });

  it('returns 409 for a nonexistent ownerId', async () => {
    const res = await request(app)
      .post('/api/copy')
      .set(authHeader(owner.email))
      .send({ albumId, locationId, ownerId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(409);
  });

  // album + location + collection are one chain (#53): a location belongs to a
  // collection, so a copy of an album in collection A cannot sit in a location
  // that belongs to collection B.
  it('returns 406 when the location belongs to another collection', async () => {
    const res = await request(app)
      .post('/api/copy')
      .set(authHeader(owner.email))
      .send({ albumId, locationId: foreignLocationId, ownerId });
    expect(res.status).toBe(406);
  });
});

// ── GET /api/copy ─────────────────────────────────────────────────────────

describe('GET /api/copy', () => {
  it('filters by albumId', async () => {
    const copy = await prisma.copy.create({ data: { albumId, locationId, ownerId } });
    const res = await request(app).get(`/api/copy?albumId=${albumId}`).set(authHeader(owner.email));
    expect(res.status).toBe(200);
    expect(res.body.data.some((c: { id: string }) => c.id === copy.id)).toBe(true);
  });

  it('returns 200 with [] when no copies match', async () => {
    const res = await request(app)
      .get('/api/copy?albumId=00000000-0000-0000-0000-000000000000')
      .set(authHeader(owner.email));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('scopes results away from an outsider', async () => {
    await prisma.copy.create({ data: { albumId, locationId, ownerId } });
    const res = await request(app).get(`/api/copy?albumId=${albumId}`).set(authHeader(outsider.email));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

// ── GET /api/copy/:id ─────────────────────────────────────────────────────

describe('GET /api/copy/:id', () => {
  it('returns 200 with copy and resolved location', async () => {
    const copy = await prisma.copy.create({ data: { albumId, locationId, ownerId, sourceId } });
    const res = await request(app).get(`/api/copy/${copy.id}`).set(authHeader(owner.email));
    expect(res.status).toBe(200);
    expect(res.body.data.location.id).toBe(locationId);
    expect(res.body.data.source.id).toBe(sourceId);
    expect(res.body.data.owner.id).toBe(ownerId);
    expect(res.body.data.owner).not.toHaveProperty('email');
  });

  it('returns 404 for an outsider', async () => {
    const copy = await prisma.copy.create({ data: { albumId, locationId, ownerId } });
    const res = await request(app).get(`/api/copy/${copy.id}`).set(authHeader(outsider.email));
    expect(res.status).toBe(404);
  });

  it('returns 404 with data:null for a nonexistent id', async () => {
    const res = await request(app)
      .get('/api/copy/00000000-0000-0000-0000-000000000000')
      .set(authHeader(owner.email));
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
  });
});

// ── PATCH /api/copy/:id ───────────────────────────────────────────────────

describe('PATCH /api/copy/:id', () => {
  it('updates a copy', async () => {
    const copy = await prisma.copy.create({ data: { albumId, locationId, ownerId } });
    const res = await request(app).patch(`/api/copy/${copy.id}`).set(authHeader(owner.email)).send({ condition: 'M' });
    expect(res.status).toBe(200);
    expect(res.body.data.condition).toBe('M');
  });

  // The reason a copy owns its owner (#53): lend a record out and the place
  // changes while the attribution does not.
  it('keeps the owner when the copy moves to another location', async () => {
    const copy = await prisma.copy.create({ data: { albumId, locationId, ownerId } });
    const res = await request(app)
      .patch(`/api/copy/${copy.id}`)
      .set(authHeader(owner.email))
      .send({ locationId: otherLocationId });
    expect(res.status).toBe(200);
    expect(res.body.data.locationId).toBe(otherLocationId);
    expect(res.body.data.ownerId).toBe(ownerId);
  });

  it('returns 406 when moved into a location in another collection', async () => {
    const copy = await prisma.copy.create({ data: { albumId, locationId, ownerId } });
    const res = await request(app)
      .patch(`/api/copy/${copy.id}`)
      .set(authHeader(owner.email))
      .send({ locationId: foreignLocationId });
    expect(res.status).toBe(406);
  });

  it('reassigns a copy to another owner', async () => {
    const copy = await prisma.copy.create({ data: { albumId, locationId, ownerId } });
    const gift = await prisma.owner.create({ data: { name: `${T}CopyGiftedTo` } });
    const res = await request(app)
      .patch(`/api/copy/${copy.id}`)
      .set(authHeader(owner.email))
      .send({ ownerId: gift.id });
    expect(res.status).toBe(200);
    expect(res.body.data.ownerId).toBe(gift.id);
  });

  it('returns 404 for an outsider', async () => {
    const copy = await prisma.copy.create({ data: { albumId, locationId, ownerId } });
    const res = await request(app).patch(`/api/copy/${copy.id}`).set(authHeader(outsider.email)).send({ condition: 'M' });
    expect(res.status).toBe(404);
  });

  it('returns 404 for a nonexistent id', async () => {
    const res = await request(app)
      .patch('/api/copy/00000000-0000-0000-0000-000000000000')
      .set(authHeader(owner.email))
      .send({ condition: 'M' });
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
  });
});

// ── DELETE /api/copy/:id ──────────────────────────────────────────────────

describe('DELETE /api/copy/:id', () => {
  it('deletes an existing copy', async () => {
    const copy = await prisma.copy.create({ data: { albumId, locationId, ownerId } });
    const res = await request(app).delete(`/api/copy/${copy.id}`).set(authHeader(owner.email));
    expect(res.status).toBe(200);

    const check = await request(app).get(`/api/copy/${copy.id}`).set(authHeader(owner.email));
    expect(check.status).toBe(404);
  });

  it('returns 404 for a nonexistent id', async () => {
    const res = await request(app)
      .delete('/api/copy/00000000-0000-0000-0000-000000000000')
      .set(authHeader(owner.email));
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
  });
});
