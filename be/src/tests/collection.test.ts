import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../database.js';
import { T, cleanupTestData, authHeader, createTestAdmin } from './setup.js';

let owner: { id: string; email: string };
let sharedMember: { id: string; email: string };
let outsider: { id: string; email: string };
let admin: { id: string; email: string };
let ownedCollectionId: string;
let sharedCollectionId: string;
let foreignCollectionId: string;

beforeAll(async () => {
  await cleanupTestData();
  owner = await prisma.user.create({ data: { email: `${T}coll-owner@example.com`, status: 'active' } });
  sharedMember = await prisma.user.create({ data: { email: `${T}coll-shared@example.com`, status: 'active' } });
  outsider = await prisma.user.create({ data: { email: `${T}coll-outsider@example.com`, status: 'active' } });
  admin = await createTestAdmin('coll-admin');

  // Owned by `owner`, not shared with anyone.
  const owned = await prisma.collection.create({ data: { name: `${T}CollOwned`, kind: 'physical', ownerId: owner.id } });
  // Owned by `owner`, shared with `sharedMember`.
  const shared = await prisma.collection.create({ data: { name: `${T}CollShared`, kind: 'digital', ownerId: owner.id } });
  // Owned by `outsider` — nobody else should see it.
  const foreign = await prisma.collection.create({ data: { name: `${T}CollForeign`, kind: 'physical', ownerId: outsider.id } });
  ownedCollectionId = owned.id;
  sharedCollectionId = shared.id;
  foreignCollectionId = foreign.id;
  await prisma.collection_share.create({ data: { collectionId: shared.id, userId: sharedMember.id, role: 'full' } });

  await prisma.album.create({ data: { collectionId: owned.id, title: `${T}CollCountA` } });
  await prisma.album.create({ data: { collectionId: owned.id, title: `${T}CollCountB` } });
});
afterAll(async () => { await cleanupTestData(); });

const names = (body: { data: { name: string }[] }) => body.data.map((c) => c.name);

// ── GET /api/collection ───────────────────────────────────────────────────

describe('GET /api/collection', () => {
  it('returns the collections a user owns', async () => {
    const res = await request(app).get('/api/collection').set(authHeader(owner.email));
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(names(res.body)).toEqual(expect.arrayContaining([`${T}CollOwned`, `${T}CollShared`]));
    expect(names(res.body)).not.toContain(`${T}CollForeign`);
  });

  it('returns a shared collection to the member it is shared with, and nothing else', async () => {
    const res = await request(app).get('/api/collection').set(authHeader(sharedMember.email));
    expect(res.status).toBe(200);
    const listed = names(res.body).filter((n) => n.startsWith(T));
    expect(listed).toEqual([`${T}CollShared`]);
  });

  it('an admin sees collections across all owners', async () => {
    const res = await request(app).get('/api/collection').set(authHeader(admin.email));
    expect(res.status).toBe(200);
    expect(names(res.body)).toEqual(
      expect.arrayContaining([`${T}CollOwned`, `${T}CollShared`, `${T}CollForeign`]),
    );
  });

  it('includes an album count for the switcher', async () => {
    const res = await request(app).get('/api/collection').set(authHeader(owner.email));
    const owned = res.body.data.find((c: { id: string }) => c.id === ownedCollectionId);
    expect(owned.albumCount).toBe(2);
    const shared = res.body.data.find((c: { id: string }) => c.id === sharedCollectionId);
    expect(shared.albumCount).toBe(0);
  });

  it('is ordered by name', async () => {
    const res = await request(app).get('/api/collection').set(authHeader(admin.email));
    // Compare within the test-prefixed subset only: they share a prefix, so JS
    // and Postgres collation agree on their relative order.
    const listed = names(res.body).filter((n) => n.startsWith(T));
    expect(listed).toEqual([...listed].sort());
  });

  it('returns 401 for an unrecognized identity', async () => {
    const res = await request(app).get('/api/collection').set(authHeader('nobody@example.com'));
    expect(res.status).toBe(401);
    expect(res.body.data).toBeNull();
  });
});

// ── GET /api/collection/:id ───────────────────────────────────────────────

describe('GET /api/collection/:id', () => {
  it('returns 200 with the collection for its owner', async () => {
    const res = await request(app).get(`/api/collection/${ownedCollectionId}`).set(authHeader(owner.email));
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(ownedCollectionId);
    expect(res.body.data.kind).toBe('physical');
  });

  it('a shared member can view the shared collection', async () => {
    const res = await request(app).get(`/api/collection/${sharedCollectionId}`).set(authHeader(sharedMember.email));
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(sharedCollectionId);
  });

  it('returns 404 for a collection the caller has no access to (masks existence)', async () => {
    const res = await request(app).get(`/api/collection/${foreignCollectionId}`).set(authHeader(sharedMember.email));
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
  });

  it('an admin can view any collection', async () => {
    const res = await request(app).get(`/api/collection/${foreignCollectionId}`).set(authHeader(admin.email));
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(foreignCollectionId);
  });

  it('returns 404 with data:null for a nonexistent id', async () => {
    const res = await request(app)
      .get('/api/collection/00000000-0000-0000-0000-000000000000')
      .set(authHeader(admin.email));
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
  });
});
