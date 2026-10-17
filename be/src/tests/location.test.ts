import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../database.js';
import { T, cleanupTestData, authHeader, createTestAdmin } from './setup.js';

// A location is a child of exactly one collection (#53), so access follows the
// collection the same way album/copy/want_item do — there is no location owner
// any more. An inaccessible location reads as 404, not 403: same masking as
// every other collection-scoped resource.

let owner: { id: string; email: string };
let outsider: { id: string; email: string };
let admin: { email: string };
let collectionId: string;
let otherCollectionId: string;
// Copies need an owner (NOT NULL since #56); these tests don't care whose.
let copyOwnerId: string;

beforeAll(async () => {
  await cleanupTestData();
  owner = await prisma.user.create({ data: { email: `${T}loc-owner@example.com`, status: 'active' } });
  outsider = await prisma.user.create({ data: { email: `${T}loc-outsider@example.com`, status: 'active' } });
  admin = await createTestAdmin('loc-admin');
  const collection = await prisma.collection.create({ data: { name: `${T}LocColl`, kind: 'physical', ownerId: owner.id } });
  collectionId = collection.id;
  // Owned by the outsider — the collection our caller must not be able to
  // create a location in.
  const other = await prisma.collection.create({
    data: { name: `${T}LocOtherColl`, kind: 'physical', ownerId: outsider.id },
  });
  otherCollectionId = other.id;
  copyOwnerId = (await prisma.owner.create({ data: { name: `${T}LocCopyOwner` } })).id;
});
afterAll(async () => { await cleanupTestData(); });

// ── POST /api/location ───────────────────────────────────────────────────

describe('POST /api/location', () => {
  it('creates a location with name + kind + collectionId', async () => {
    const res = await request(app)
      .post('/api/location')
      .set(authHeader(owner.email))
      .send({ name: `${T}Basement`, kind: 'physical', collectionId });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe(`${T}Basement`);
    expect(res.body.data.collectionId).toBe(collectionId);
  });

  // #45 review: an empty <select> submits "", which is "not given", not "no access".
  it.each([[''], [null]])('returns 406 when collectionId is %j', async (value) => {
    const res = await request(app)
      .post('/api/location')
      .set(authHeader(owner.email))
      .send({ name: `${T}BlankColl`, kind: 'physical', collectionId: value });
    expect(res.status).toBe(406);
  });

  it('creates a nested location with parentLocationId', async () => {
    const parent = await prisma.location.create({ data: { name: `${T}ParentRoom`, kind: 'physical', collectionId } });
    const res = await request(app)
      .post('/api/location')
      .set(authHeader(owner.email))
      .send({ name: `${T}Shelf3`, kind: 'physical', collectionId, parentLocationId: parent.id });
    expect(res.status).toBe(201);
    expect(res.body.data.parentLocationId).toBe(parent.id);
  });

  it('returns 406 when name is missing', async () => {
    const res = await request(app)
      .post('/api/location')
      .set(authHeader(owner.email))
      .send({ kind: 'physical', collectionId });
    expect(res.status).toBe(406);
  });

  it('returns 406 when kind is missing', async () => {
    const res = await request(app)
      .post('/api/location')
      .set(authHeader(owner.email))
      .send({ name: `${T}NoKind`, collectionId });
    expect(res.status).toBe(406);
  });

  it('returns 406 when collectionId is missing', async () => {
    const res = await request(app)
      .post('/api/location')
      .set(authHeader(owner.email))
      .send({ name: `${T}NoColl`, kind: 'physical' });
    expect(res.status).toBe(406);
  });

  // #102: a parent from another collection would leak its name through
  // `parent` and straddle the collection boundary copies respect (#53).
  it('returns 406 for a parent in another collection, and creates nothing', async () => {
    const foreign = await prisma.location.create({ data: { name: `${T}ForeignParent`, kind: 'physical', collectionId: otherCollectionId } });
    const res = await request(app)
      .post('/api/location')
      .set(authHeader(owner.email))
      .send({ name: `${T}CrossChild`, kind: 'physical', collectionId, parentLocationId: foreign.id });
    expect(res.status).toBe(406);
    expect(await prisma.location.count({ where: { name: `${T}CrossChild` } })).toBe(0);
  });

  // "" is a malformed id, not "top level" (that is `null` or leaving it out).
  it('returns 406 when parentLocationId is ""', async () => {
    const res = await request(app)
      .post('/api/location')
      .set(authHeader(owner.email))
      .send({ name: `${T}BlankParent`, kind: 'physical', collectionId, parentLocationId: '' });
    expect(res.status).toBe(406);
  });

  it('returns 403 when creating a location in a collection the caller has no access to', async () => {
    const res = await request(app)
      .post('/api/location')
      .set(authHeader(owner.email))
      .send({ name: `${T}NotMyColl`, kind: 'physical', collectionId: otherCollectionId });
    expect(res.status).toBe(403);
  });
});

// ── GET /api/location ────────────────────────────────────────────────────

describe('GET /api/location', () => {
  it('returns 200 with an array including resolved parent', async () => {
    const parent = await prisma.location.create({ data: { name: `${T}ListParent`, kind: 'physical', collectionId } });
    await prisma.location.create({
      data: { name: `${T}ListChild`, kind: 'physical', collectionId, parentLocationId: parent.id },
    });
    const res = await request(app).get('/api/location').set(authHeader(owner.email));
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    const child = res.body.data.find((l: { name: string }) => l.name === `${T}ListChild`);
    expect(child.parent.name).toBe(`${T}ListParent`);
  });

  it('hides locations in collections the caller has no access to', async () => {
    const mine = await prisma.location.create({ data: { name: `${T}ScopedMine`, kind: 'physical', collectionId } });
    const theirs = await prisma.location.create({
      data: { name: `${T}ScopedTheirs`, kind: 'physical', collectionId: otherCollectionId },
    });
    const res = await request(app).get('/api/location').set(authHeader(owner.email));
    expect(res.status).toBe(200);
    const ids = res.body.data.map((l: { id: string }) => l.id);
    expect(ids).toContain(mine.id);
    expect(ids).not.toContain(theirs.id);
  });

  it('filters by collectionId, for a picker that must not offer another collection (#8)', async () => {
    const mine = await prisma.location.create({ data: { name: `${T}FilterMine`, kind: 'physical', collectionId } });
    const res = await request(app).get(`/api/location?collectionId=${collectionId}`).set(authHeader(owner.email));
    expect(res.status).toBe(200);
    expect(res.body.data.map((l: { id: string }) => l.id)).toContain(mine.id);
    expect(
      res.body.data.every((l: { collectionId: string }) => l.collectionId === collectionId),
    ).toBe(true);
  });

  it('an admin sees locations from any collection', async () => {
    const theirs = await prisma.location.create({
      data: { name: `${T}AdminSees`, kind: 'physical', collectionId: otherCollectionId },
    });
    const res = await request(app).get('/api/location').set(authHeader(admin.email));
    expect(res.status).toBe(200);
    expect(res.body.data.map((l: { id: string }) => l.id)).toContain(theirs.id);
  });
});

// ── GET /api/location/:id ────────────────────────────────────────────────

describe('GET /api/location/:id', () => {
  it('returns 200 with location and copies stored directly there', async () => {
    const location = await prisma.location.create({ data: { name: `${T}DirectLoc`, kind: 'physical', collectionId } });
    const album = await prisma.album.create({ data: { collectionId, title: `${T}LocAlbum` } });
    await prisma.copy.create({ data: { albumId: album.id, locationId: location.id, ownerId: copyOwnerId } });

    const res = await request(app).get(`/api/location/${location.id}`).set(authHeader(owner.email));
    expect(res.status).toBe(200);
    expect(res.body.data.copies).toHaveLength(1);
  });

  it('rolls up copies from child locations', async () => {
    const basement = await prisma.location.create({ data: { name: `${T}RollupBasement`, kind: 'physical', collectionId } });
    const shelf = await prisma.location.create({
      data: { name: `${T}RollupShelf`, kind: 'physical', collectionId, parentLocationId: basement.id },
    });
    const album = await prisma.album.create({ data: { collectionId, title: `${T}RollupAlbum` } });
    await prisma.copy.create({ data: { albumId: album.id, locationId: shelf.id, ownerId: copyOwnerId } });

    const res = await request(app).get(`/api/location/${basement.id}`).set(authHeader(owner.email));
    expect(res.status).toBe(200);
    expect(res.body.data.copies).toHaveLength(1);
    expect(res.body.data.copies[0].locationId).toBe(shelf.id);
  });

  it('returns 404 for a location in a collection the caller has no access to', async () => {
    const location = await prisma.location.create({
      data: { name: `${T}HiddenLoc`, kind: 'physical', collectionId: otherCollectionId },
    });
    const res = await request(app).get(`/api/location/${location.id}`).set(authHeader(owner.email));
    expect(res.status).toBe(404);
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
  it('lets a member of the collection update its location', async () => {
    const location = await prisma.location.create({ data: { name: `${T}ToUpdate`, kind: 'physical', collectionId } });
    const res = await request(app)
      .patch(`/api/location/${location.id}`)
      .set(authHeader(owner.email))
      .send({ name: `${T}Updated` });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe(`${T}Updated`);
  });

  it('returns 404 when the caller has no access to the location collection', async () => {
    const location = await prisma.location.create({
      data: { name: `${T}NotYours`, kind: 'physical', collectionId: otherCollectionId },
    });
    const res = await request(app)
      .patch(`/api/location/${location.id}`)
      .set(authHeader(owner.email))
      .send({ name: `${T}ShouldFail` });
    expect(res.status).toBe(404);
  });

  it('an admin can edit a location in any collection', async () => {
    const location = await prisma.location.create({
      data: { name: `${T}AdminEdit`, kind: 'physical', collectionId: otherCollectionId },
    });
    const res = await request(app)
      .patch(`/api/location/${location.id}`)
      .set(authHeader(admin.email))
      .send({ name: `${T}AdminEdited` });
    expect(res.status).toBe(200);
  });

  describe('parent', () => {
    let room: { id: string };
    let shelf: { id: string };
    let bin: { id: string };
    beforeAll(async () => {
      room = await prisma.location.create({ data: { name: `${T}PRoom`, kind: 'physical', collectionId } });
      shelf = await prisma.location.create({ data: { name: `${T}PShelf`, kind: 'physical', collectionId, parentLocationId: room.id } });
      bin = await prisma.location.create({ data: { name: `${T}PBin`, kind: 'physical', collectionId, parentLocationId: shelf.id } });
    });
    const patch = (id: string, parentLocationId: string | null) =>
      request(app).patch(`/api/location/${id}`).set(authHeader(owner.email)).send({ parentLocationId });

    // #102: the parent chain must never loop.
    it.each([
      ['itself', () => [room.id, room.id]],
      ['its own child', () => [room.id, shelf.id]],
      ['its own grandchild', () => [room.id, bin.id]],
    ])('returns 406 for a parent that is %s, and leaves it unchanged', async (_label, ids) => {
      const [id, parent] = ids();
      const res = await patch(id!, parent!);
      expect(res.status).toBe(406);
      expect((await prisma.location.findUnique({ where: { id: id! } }))?.parentLocationId).toBeNull();
    });

    it('returns 406 for a parent in another collection', async () => {
      const foreign = await prisma.location.create({ data: { name: `${T}PForeign`, kind: 'physical', collectionId: otherCollectionId } });
      const res = await patch(bin.id, foreign.id);
      expect(res.status).toBe(406);
      expect((await prisma.location.findUnique({ where: { id: bin.id } }))?.parentLocationId).toBe(shelf.id);
    });

    it('moves a location to another parent in the same collection', async () => {
      const res = await patch(bin.id, room.id);
      expect(res.status).toBe(200);
      expect(res.body.data.parentLocationId).toBe(room.id);
    });

    it('moves a location back to the top level with null', async () => {
      const res = await patch(bin.id, null);
      expect(res.status).toBe(200);
      expect(res.body.data.parentLocationId).toBeNull();
    });
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
    const location = await prisma.location.create({ data: { name: `${T}ToDelete`, kind: 'physical', collectionId } });
    const res = await request(app).delete(`/api/location/${location.id}`).set(authHeader(owner.email));
    expect(res.status).toBe(200);

    const check = await request(app).get(`/api/location/${location.id}`).set(authHeader(owner.email));
    expect(check.status).toBe(404);
  });

  it('returns 404 when the caller has no access to the location collection', async () => {
    const location = await prisma.location.create({
      data: { name: `${T}NotYoursToDelete`, kind: 'physical', collectionId: otherCollectionId },
    });
    const res = await request(app).delete(`/api/location/${location.id}`).set(authHeader(owner.email));
    expect(res.status).toBe(404);
  });

  // #102: deleting a parent used to succeed and silently move its children to
  // the top level (Prisma's SetNull default for an optional relation).
  it('returns 409 while a location has locations inside it, and moves nothing', async () => {
    const parent = await prisma.location.create({ data: { name: `${T}DelParent`, kind: 'physical', collectionId } });
    const child = await prisma.location.create({ data: { name: `${T}DelChild`, kind: 'physical', collectionId, parentLocationId: parent.id } });
    const res = await request(app).delete(`/api/location/${parent.id}`).set(authHeader(owner.email));
    expect(res.status).toBe(409);
    expect(await prisma.location.findUnique({ where: { id: parent.id } })).not.toBeNull();
    expect((await prisma.location.findUnique({ where: { id: child.id } }))?.parentLocationId).toBe(parent.id);
  });

  it('returns 404 for a nonexistent id', async () => {
    const res = await request(app)
      .delete('/api/location/00000000-0000-0000-0000-000000000000')
      .set(authHeader(owner.email));
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
  });
});
