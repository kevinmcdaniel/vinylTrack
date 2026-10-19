import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../database.js';
import { T, cleanupTestData, authHeader, createTestAdmin } from './setup.js';

let owner: { id: string; email: string };
let outsider: { id: string; email: string };
let admin: { id: string; email: string };
let collectionId: string;
let artistId: string;
let albumId: string;
let ownerRowId: string;

beforeAll(async () => {
  await cleanupTestData();
  owner = await prisma.user.create({ data: { email: `${T}want-owner@example.com`, status: 'active' } });
  outsider = await prisma.user.create({ data: { email: `${T}want-outsider@example.com`, status: 'active' } });
  admin = await createTestAdmin('want-admin');
  const collection = await prisma.collection.create({ data: { name: `${T}WantColl`, kind: 'physical', ownerId: owner.id } });
  collectionId = collection.id;
  const artist = await prisma.artist.create({ data: { name: `${T}WantArtist` } });
  artistId = artist.id;
  const album = await prisma.album.create({ data: { collectionId, title: `${T}WantAlbum` } });
  albumId = album.id;
  const ownerRow = await prisma.owner.create({ data: { name: `${T}WantOwner`, userId: owner.id } });
  ownerRowId = ownerRow.id;
});
afterAll(async () => { await cleanupTestData(); });

// ── POST /api/want ────────────────────────────────────────────────────────

describe('POST /api/want', () => {
  it('creates an artist-level want', async () => {
    const res = await request(app)
      .post('/api/want')
      .set(authHeader(owner.email))
      .send({ collectionId, artistId, priority: 'nice-to-have' });
    expect(res.status).toBe(201);
    expect(res.body.data.artistId).toBe(artistId);
    expect(res.body.data.albumId).toBeNull();
  });

  it('creates an album-level want', async () => {
    const res = await request(app)
      .post('/api/want')
      .set(authHeader(owner.email))
      .send({ collectionId, albumId, priority: 'must-have' });
    expect(res.status).toBe(201);
    expect(res.body.data.albumId).toBe(albumId);
  });

  // #45 review: an empty <select> submits "", which is "not given", not "no access".
  it.each([[''], [null]])('returns 406 when collectionId is %j', async (value) => {
    const res = await request(app)
      .post('/api/want')
      .set(authHeader(owner.email))
      .send({ collectionId: value, artistId, priority: 'must-have' });
    expect(res.status).toBe(406);
  });

  it('returns 403 for an outsider posting into a collection they do not belong to', async () => {
    const res = await request(app)
      .post('/api/want')
      .set(authHeader(outsider.email))
      .send({ collectionId, artistId, priority: 'must-have' });
    expect(res.status).toBe(403);
  });

  it('returns 406 when priority is missing', async () => {
    const res = await request(app).post('/api/want').set(authHeader(owner.email)).send({ collectionId, artistId });
    expect(res.status).toBe(406);
  });

  it('returns 406 when neither artistId nor albumId is set', async () => {
    const res = await request(app)
      .post('/api/want')
      .set(authHeader(owner.email))
      .send({ collectionId, priority: 'must-have' });
    expect(res.status).toBe(406);
  });

  it('returns 406 when both artistId and albumId are set', async () => {
    const res = await request(app)
      .post('/api/want')
      .set(authHeader(owner.email))
      .send({ collectionId, artistId, albumId, priority: 'must-have' });
    expect(res.status).toBe(406);
  });

  it('returns 409 for a nonexistent collectionId', async () => {
    const res = await request(app)
      .post('/api/want')
      .set(authHeader(admin.email))
      .send({ collectionId: '00000000-0000-0000-0000-000000000000', artistId, priority: 'must-have' });
    expect(res.status).toBe(409);
  });
});

// ── GET /api/want ─────────────────────────────────────────────────────────

describe('GET /api/want', () => {
  it('filters by collectionId', async () => {
    const res = await request(app).get(`/api/want?collectionId=${collectionId}`).set(authHeader(owner.email));
    expect(res.status).toBe(200);
    expect(res.body.data.every((w: { collectionId: string }) => w.collectionId === collectionId)).toBe(true);
  });

  it('returns 200 with [] when no wants match', async () => {
    const res = await request(app)
      .get('/api/want?collectionId=00000000-0000-0000-0000-000000000000')
      .set(authHeader(owner.email));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('scopes results away from an outsider', async () => {
    const res = await request(app).get(`/api/want?collectionId=${collectionId}`).set(authHeader(outsider.email));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

// ── PATCH /api/want/:id ───────────────────────────────────────────────────

describe('PATCH /api/want/:id', () => {
  it('updates priority and notes', async () => {
    const want = await prisma.want_item.create({ data: { collectionId, artistId, priority: 'nice-to-have' } });
    const res = await request(app)
      .patch(`/api/want/${want.id}`)
      .set(authHeader(owner.email))
      .send({ priority: 'must-have', notes: 'upgrade' });
    expect(res.status).toBe(200);
    expect(res.body.data.priority).toBe('must-have');
    expect(res.body.data.notes).toBe('upgrade');
  });

  it('returns 404 for an outsider', async () => {
    const want = await prisma.want_item.create({ data: { collectionId, artistId, priority: 'nice-to-have' } });
    const res = await request(app)
      .patch(`/api/want/${want.id}`)
      .set(authHeader(outsider.email))
      .send({ priority: 'must-have' });
    expect(res.status).toBe(404);
  });

  it('returns 404 for a nonexistent id', async () => {
    const res = await request(app)
      .patch('/api/want/00000000-0000-0000-0000-000000000000')
      .set(authHeader(owner.email))
      .send({ priority: 'must-have' });
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
  });
});

// ── DELETE /api/want/:id ──────────────────────────────────────────────────

describe('DELETE /api/want/:id', () => {
  it('deletes an existing want item', async () => {
    const want = await prisma.want_item.create({ data: { collectionId, artistId, priority: 'nice-to-have' } });
    const res = await request(app).delete(`/api/want/${want.id}`).set(authHeader(owner.email));
    expect(res.status).toBe(200);

    const list = await request(app).get(`/api/want?collectionId=${collectionId}`).set(authHeader(owner.email));
    expect(list.body.data.some((w: { id: string }) => w.id === want.id)).toBe(false);
  });

  it('returns 404 for a nonexistent id', async () => {
    const res = await request(app)
      .delete('/api/want/00000000-0000-0000-0000-000000000000')
      .set(authHeader(owner.email));
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
  });
});

// ── POST /api/want/:id/found ──────────────────────────────────────────────

describe('POST /api/want/:id/found', () => {
  it('converts an album-level want into a copy, then removes the want', async () => {
    const location = await prisma.location.create({ data: { name: `${T}FoundLoc1`, kind: 'physical', collectionId } });
    const want = await prisma.want_item.create({ data: { collectionId, albumId, priority: 'must-have' } });

    const res = await request(app)
      .post(`/api/want/${want.id}/found`)
      .set(authHeader(owner.email))
      .send({ locationId: location.id, price: 19.99 });
    expect(res.status).toBe(201);
    expect(res.body.data.copy.albumId).toBe(albumId);
    expect(res.body.data.copy.locationId).toBe(location.id);
    // Nothing said who — the copy lands with the caller's own owner row (#53).
    expect(res.body.data.copy.ownerId).toBe(ownerRowId);

    const check = await prisma.want_item.findUnique({ where: { id: want.id } });
    expect(check).toBeNull();
  });

  it('converts an artist-level want by linking an existing album, then removes the want', async () => {
    const location = await prisma.location.create({ data: { name: `${T}FoundLoc2`, kind: 'physical', collectionId } });
    const existingAlbum = await prisma.album.create({ data: { collectionId, title: `${T}ExistingForFound` } });
    const want = await prisma.want_item.create({ data: { collectionId, artistId, priority: 'nice-to-have' } });

    const res = await request(app)
      .post(`/api/want/${want.id}/found`)
      .set(authHeader(owner.email))
      .send({ locationId: location.id, albumId: existingAlbum.id });
    expect(res.status).toBe(201);
    expect(res.body.data.copy.albumId).toBe(existingAlbum.id);

    const link = await prisma.album_artist.findUnique({
      where: { albumId_artistId: { albumId: existingAlbum.id, artistId } },
    });
    expect(link).not.toBeNull();
  });

  it('converts an artist-level want by creating a new album inline, then removes the want', async () => {
    const location = await prisma.location.create({ data: { name: `${T}FoundLoc3`, kind: 'physical', collectionId } });
    const want = await prisma.want_item.create({ data: { collectionId, artistId, priority: 'must-have' } });

    const res = await request(app)
      .post(`/api/want/${want.id}/found`)
      .set(authHeader(owner.email))
      .send({ locationId: location.id, album: { title: `${T}NewFoundAlbum`, format: 'LP' } });
    expect(res.status).toBe(201);
    expect(res.body.data.album.title).toBe(`${T}NewFoundAlbum`);
    expect(res.body.data.album.collectionId).toBe(collectionId);

    const link = await prisma.album_artist.findUnique({
      where: { albumId_artistId: { albumId: res.body.data.album.id, artistId } },
    });
    expect(link).not.toBeNull();
  });

  it('records the buyer when an explicit ownerId is given', async () => {
    const location = await prisma.location.create({ data: { name: `${T}FoundLoc7`, kind: 'physical', collectionId } });
    const gift = await prisma.owner.create({ data: { name: `${T}FoundForGrandma` } });
    const want = await prisma.want_item.create({ data: { collectionId, albumId, priority: 'must-have' } });

    const res = await request(app)
      .post(`/api/want/${want.id}/found`)
      .set(authHeader(owner.email))
      .send({ locationId: location.id, ownerId: gift.id });
    expect(res.status).toBe(201);
    expect(res.body.data.copy.ownerId).toBe(gift.id);
  });

  it('returns 406 when the location belongs to another collection', async () => {
    const otherCollection = await prisma.collection.create({
      data: { name: `${T}WantOtherColl`, kind: 'physical', ownerId: owner.id },
    });
    const location = await prisma.location.create({
      data: { name: `${T}FoundLocForeign`, kind: 'physical', collectionId: otherCollection.id },
    });
    const want = await prisma.want_item.create({ data: { collectionId, albumId, priority: 'must-have' } });

    const res = await request(app)
      .post(`/api/want/${want.id}/found`)
      .set(authHeader(owner.email))
      .send({ locationId: location.id });
    expect(res.status).toBe(406);
  });

  it('returns 406 when locationId is missing', async () => {
    const want = await prisma.want_item.create({ data: { collectionId, albumId, priority: 'must-have' } });
    const res = await request(app).post(`/api/want/${want.id}/found`).set(authHeader(owner.email)).send({});
    expect(res.status).toBe(406);
  });

  it('returns 406 for an artist-level want with no albumId or album payload', async () => {
    const location = await prisma.location.create({ data: { name: `${T}FoundLoc4`, kind: 'physical', collectionId } });
    const want = await prisma.want_item.create({ data: { collectionId, artistId, priority: 'must-have' } });
    const res = await request(app)
      .post(`/api/want/${want.id}/found`)
      .set(authHeader(owner.email))
      .send({ locationId: location.id });
    expect(res.status).toBe(406);
  });

  it('returns 404 for an outsider', async () => {
    const location = await prisma.location.create({ data: { name: `${T}FoundLoc6`, kind: 'physical', collectionId } });
    const want = await prisma.want_item.create({ data: { collectionId, albumId, priority: 'must-have' } });
    const res = await request(app)
      .post(`/api/want/${want.id}/found`)
      .set(authHeader(outsider.email))
      .send({ locationId: location.id });
    expect(res.status).toBe(404);
  });

  it('returns 404 for a nonexistent want id', async () => {
    const location = await prisma.location.create({ data: { name: `${T}FoundLoc5`, kind: 'physical', collectionId } });
    const res = await request(app)
      .post('/api/want/00000000-0000-0000-0000-000000000000/found')
      .set(authHeader(owner.email))
      .send({ locationId: location.id });
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
  });
});

// ── field types ──────────────────────────────────────────────────────────

// Mark-as-found creates a copy (and maybe an album), so the same field rules
// apply, and a refusal must leave the want in place.
describe('POST /api/want/:id/found field validation', () => {
  it.each([
    [{ dateAcquired: '2024-02-31' }, /dateAcquired/],
    [{ price: 'free' }, /price/],
  ])('returns 406 for %j and keeps the want', async (fields, message) => {
    const location = await prisma.location.create({ data: { name: `${T}FoundBadLoc`, kind: 'physical', collectionId } });
    const want = await prisma.want_item.create({ data: { collectionId, albumId, priority: 'must-have' } });
    const res = await request(app)
      .post(`/api/want/${want.id}/found`)
      .set(authHeader(owner.email))
      .send({ locationId: location.id, ...fields });
    expect(res.status).toBe(406);
    expect(res.body.message).toMatch(message);
    expect(await prisma.want_item.findUnique({ where: { id: want.id } })).not.toBeNull();
  });

  it('returns 406 for a string year on a new album', async () => {
    const location = await prisma.location.create({ data: { name: `${T}FoundBadYearLoc`, kind: 'physical', collectionId } });
    const want = await prisma.want_item.create({ data: { collectionId, artistId, priority: 'must-have' } });
    const res = await request(app)
      .post(`/api/want/${want.id}/found`)
      .set(authHeader(owner.email))
      .send({ locationId: location.id, album: { title: `${T}FoundBadYear`, year: '1999' } });
    expect(res.status).toBe(406);
    expect(res.body.message).toMatch(/year/);
  });
});

// ── priority (#8 task 0) ─────────────────────────────────────────────────

// The list groups by exactly these two; anything else would vanish from it.
describe('want priority values', () => {
  it.each([['medium'], ['MUST-HAVE'], [1]])('POST returns 406 for priority %j', async (priority) => {
    const res = await request(app)
      .post('/api/want')
      .set(authHeader(owner.email))
      .send({ collectionId, artistId, priority });
    expect(res.status).toBe(406);
    expect(res.body.message).toMatch(/priority/);
  });

  it.each([['urgent'], [null], ['']])('PATCH returns 406 for priority %j and leaves the want alone', async (priority) => {
    const want = await prisma.want_item.create({ data: { collectionId, artistId, priority: 'nice-to-have' } });
    const res = await request(app).patch(`/api/want/${want.id}`).set(authHeader(owner.email)).send({ priority });
    expect(res.status).toBe(406);
    expect((await prisma.want_item.findUnique({ where: { id: want.id } }))?.priority).toBe('nice-to-have');
  });

  it('PATCH without priority still updates notes', async () => {
    const want = await prisma.want_item.create({ data: { collectionId, artistId, priority: 'nice-to-have' } });
    const res = await request(app).patch(`/api/want/${want.id}`).set(authHeader(owner.email)).send({ notes: 'any pressing' });
    expect(res.status).toBe(200);
    expect(res.body.data.notes).toBe('any pressing');
  });
});

// ── list shape + duplicate check (#8 task 0, #13) ────────────────────────

describe('GET /api/want — shape, order, includeMatches', () => {
  let collId: string;
  let otherCollId: string;
  let miles: string;
  let coltrane: string;
  let wantedAlbum: string;
  let alex: string;
  let shelf: string;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    collId = (await prisma.collection.create({ data: { name: `${T}MatchColl`, kind: 'physical', ownerId: owner.id } })).id;
    otherCollId = (await prisma.collection.create({ data: { name: `${T}MatchOther`, kind: 'physical', ownerId: owner.id } })).id;
    miles = (await prisma.artist.create({ data: { name: `${T}Miles` } })).id;
    coltrane = (await prisma.artist.create({ data: { name: `${T}Coltrane` } })).id;
    alex = (await prisma.owner.create({ data: { name: `${T}Alex` } })).id;
    const room = await prisma.location.create({ data: { name: `${T}Basement`, kind: 'physical', collectionId: collId } });
    shelf = (await prisma.location.create({ data: { name: `${T}Shelf 3`, kind: 'physical', collectionId: collId, parentLocationId: room.id } })).id;
    const otherLoc = await prisma.location.create({ data: { name: `${T}OtherLoc`, kind: 'physical', collectionId: otherCollId } });

    const album = async (title: string, artistIds: string[], coll = collId) =>
      (await prisma.album.create({
        data: { collectionId: coll, title, artists: { create: artistIds.map((artistId) => ({ artistId })) } },
      })).id;
    const copy = (albumId: string, locationId = shelf) => prisma.copy.create({ data: { albumId, locationId, ownerId: alex } });

    // The wanted row itself, owned by Alex.
    wantedAlbum = await album(`${T}Kind of Blue`, [miles]);
    await copy(wantedAlbum);
    // Another pressing: case/punctuation differ, shares an artist → a match.
    ids.edition = await album(`${T}kind of blue!`, [miles, coltrane]);
    await copy(ids.edition);
    // Same title, no shared artist → not a match ("Greatest Hits" problem).
    ids.stranger = await album(`${T}Kind of Blue`, [coltrane]);
    await copy(ids.stranger);
    // Same title + artist in another collection → never a match (#14).
    ids.elsewhere = await album(`${T}Kind of Blue`, [miles], otherCollId);
    await copy(ids.elsewhere, otherLoc.id);
    // Coltrane album with a copy, and a Miles album nobody owns.
    ids.coltraneOwned = await album(`${T}Blue Train`, [coltrane]);
    await copy(ids.coltraneOwned);
    ids.milesUnowned = await album(`${T}Sketches of Spain`, [miles]);
    ids.missAlbum = await album(`${T}Nobody Has This`, [miles]);

    ids.wantAlbum = (await prisma.want_item.create({ data: { collectionId: collId, albumId: wantedAlbum, priority: 'nice-to-have' } })).id;
    ids.wantMiss = (await prisma.want_item.create({ data: { collectionId: collId, albumId: ids.missAlbum, priority: 'must-have' } })).id;
    ids.wantColtrane = (await prisma.want_item.create({ data: { collectionId: collId, artistId: coltrane, priority: 'must-have' } })).id;
  });

  const list = (query = '') =>
    request(app).get(`/api/want?collectionId=${collId}${query}`).set(authHeader(owner.email));
  type Row = { id: string; priority: string; album: { artists: { name: string }[] } | null; matches?: Match[] };
  type Match = {
    album: { id: string; title: string; artists: { id: string; name: string }[] };
    copies: { id: string; owner: Record<string, unknown>; location: { name: string; parent: { name: string } | null } }[];
  };
  const row = (body: { data: Row[] }, id: string) => body.data.find((w) => w.id === id)!;

  it('includes the album artists on album-level wants', async () => {
    const res = await list();
    expect(row(res.body, ids.wantAlbum).album!.artists.map((a) => a.name)).toEqual([`${T}Miles`]);
  });

  it('orders must-have first, then by id', async () => {
    const res = await list();
    const keys = res.body.data.map((w: Row) => `${w.priority}|${w.id}`);
    expect(keys).toEqual([...keys].sort());
    expect(res.body.data[0].priority).toBe('must-have');
  });

  it('leaves matches off unless asked', async () => {
    const res = await list();
    expect(row(res.body, ids.wantAlbum)).not.toHaveProperty('matches');
  });

  it('album-level want: the album itself and another edition sharing an artist', async () => {
    const res = await list('&includeMatches=true');
    const matches = row(res.body, ids.wantAlbum).matches!;
    expect(matches.map((m) => m.album.id)).toEqual([wantedAlbum, ids.edition]);
    const [copy] = matches[0].copies;
    expect(copy.owner).toEqual({ id: alex, name: `${T}Alex` });
    expect(copy.location.name).toBe(`${T}Shelf 3`);
    expect(copy.location.parent!.name).toBe(`${T}Basement`);
  });

  it('album-level want with no copies anywhere in the collection: no matches', async () => {
    const res = await list('&includeMatches=true');
    expect(row(res.body, ids.wantMiss).matches).toEqual([]);
  });

  it('artist-level want: only albums crediting the artist that have a copy', async () => {
    const res = await list('&includeMatches=true');
    const albumIds = row(res.body, ids.wantColtrane).matches!.map((m) => m.album.id);
    expect(albumIds).toEqual(expect.arrayContaining([ids.coltraneOwned, ids.edition, ids.stranger]));
    expect(albumIds).not.toContain(ids.elsewhere);
    expect(albumIds).toHaveLength(3);
  });

  it('never matches across collections or by title alone', async () => {
    const res = await list('&includeMatches=true');
    const albumIds = row(res.body, ids.wantAlbum).matches!.map((m) => m.album.id);
    expect(albumIds).not.toContain(ids.stranger);
    expect(albumIds).not.toContain(ids.elsewhere);
    expect(albumIds).not.toContain(ids.milesUnowned);
  });
});
