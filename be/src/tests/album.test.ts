import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../database.js';
import { T, cleanupTestData, authHeader, createTestAdmin } from './setup.js';

let owner: { id: string; email: string };
let sharedMember: { id: string; email: string };
let outsider: { id: string; email: string };
let admin: { id: string; email: string };
let collectionId: string;
let otherCollectionId: string;
let artistId: string;
let otherArtistId: string;

beforeAll(async () => {
  await cleanupTestData();
  owner = await prisma.user.create({ data: { email: `${T}album-owner@example.com`, status: 'active' } });
  sharedMember = await prisma.user.create({ data: { email: `${T}album-shared@example.com`, status: 'active' } });
  outsider = await prisma.user.create({ data: { email: `${T}album-outsider@example.com`, status: 'active' } });
  admin = await createTestAdmin('album-admin');
  const collection = await prisma.collection.create({ data: { name: `${T}AlbumColl`, kind: 'physical', ownerId: owner.id } });
  const other = await prisma.collection.create({ data: { name: `${T}OtherColl`, kind: 'digital', ownerId: owner.id } });
  collectionId = collection.id;
  otherCollectionId = other.id;
  await prisma.collection_share.create({ data: { collectionId, userId: sharedMember.id, role: 'full' } });
  const artist = await prisma.artist.create({ data: { name: `${T}AlbumArtist` } });
  const otherArtist = await prisma.artist.create({ data: { name: `${T}OtherArtist` } });
  artistId = artist.id;
  otherArtistId = otherArtist.id;
});
afterAll(async () => { await cleanupTestData(); });

// ── POST /api/album ──────────────────────────────────────────────────────

describe('POST /api/album', () => {
  it('creates an album with collectionId + title only', async () => {
    const res = await request(app).post('/api/album').set(authHeader(owner.email)).send({ collectionId, title: `${T}NewAlbum` });
    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe(`${T}NewAlbum`);
    expect(res.body.data.collectionId).toBe(collectionId);
  });

  it('creates an album with artistIds, writing album_artist rows', async () => {
    const res = await request(app)
      .post('/api/album')
      .set(authHeader(owner.email))
      .send({ collectionId, title: `${T}CreditedAlbum`, artistIds: [artistId, otherArtistId] });
    expect(res.status).toBe(201);
    expect(res.body.data.artists).toBeInstanceOf(Array);
    expect(res.body.data.artists.map((a: { id: string }) => a.id).sort()).toEqual([artistId, otherArtistId].sort());
  });

  it('a shared member can also create in the collection', async () => {
    const res = await request(app)
      .post('/api/album')
      .set(authHeader(sharedMember.email))
      .send({ collectionId, title: `${T}SharedCreate` });
    expect(res.status).toBe(201);
  });

  it('returns 403 for an outsider posting into a collection they do not belong to', async () => {
    const res = await request(app)
      .post('/api/album')
      .set(authHeader(outsider.email))
      .send({ collectionId, title: `${T}OutsiderCreate` });
    expect(res.status).toBe(403);
  });

  it('returns 406 when title is missing', async () => {
    const res = await request(app).post('/api/album').set(authHeader(owner.email)).send({ collectionId });
    expect(res.status).toBe(406);
  });

  it('returns 406 when collectionId is missing', async () => {
    const res = await request(app).post('/api/album').set(authHeader(owner.email)).send({ title: `${T}NoColl` });
    expect(res.status).toBe(406);
  });

  it('returns 409 for a nonexistent collectionId', async () => {
    const res = await request(app)
      .post('/api/album')
      .set(authHeader(admin.email))
      .send({ collectionId: '00000000-0000-0000-0000-000000000000', title: `${T}BadColl` });
    expect(res.status).toBe(409);
  });
});

// ── GET /api/album ───────────────────────────────────────────────────────

describe('GET /api/album', () => {
  it('returns 200 with [] when no albums match', async () => {
    const res = await request(app).get('/api/album?format=zzznomatch').set(authHeader(owner.email));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('filters by collectionId', async () => {
    await prisma.album.create({ data: { collectionId, title: `${T}InColl` } });
    await prisma.album.create({ data: { collectionId: otherCollectionId, title: `${T}InOtherColl` } });
    const res = await request(app).get(`/api/album?collectionId=${collectionId}`).set(authHeader(owner.email));
    expect(res.status).toBe(200);
    const titles = res.body.data.map((a: { title: string }) => a.title);
    expect(titles).toContain(`${T}InColl`);
    expect(titles).not.toContain(`${T}InOtherColl`);
  });

  it('filters by artistId', async () => {
    const album = await prisma.album.create({ data: { collectionId, title: `${T}ByArtist` } });
    await prisma.album_artist.create({ data: { albumId: album.id, artistId } });
    const res = await request(app).get(`/api/album?artistId=${artistId}`).set(authHeader(owner.email));
    expect(res.status).toBe(200);
    expect(res.body.data.some((a: { id: string }) => a.id === album.id)).toBe(true);
  });

  it('filters by format and genre', async () => {
    await prisma.album.create({ data: { collectionId, title: `${T}FormatMatch`, format: 'LP', genre: 'Jazz' } });
    const res = await request(app).get('/api/album?format=LP&genre=Jazz').set(authHeader(owner.email));
    expect(res.status).toBe(200);
    expect(res.body.data.some((a: { title: string }) => a.title === `${T}FormatMatch`)).toBe(true);
  });

  it('scopes results to accessible collections for a non-admin caller (#26)', async () => {
    await prisma.album.create({ data: { collectionId, title: `${T}ScopeOwnerOnly` } });
    const res = await request(app).get('/api/album').set(authHeader(outsider.email));
    expect(res.status).toBe(200);
    expect(res.body.data.some((a: { title: string }) => a.title === `${T}ScopeOwnerOnly`)).toBe(false);
  });

  it('a shared member sees the shared collection', async () => {
    await prisma.album.create({ data: { collectionId, title: `${T}ScopeShared` } });
    const res = await request(app).get('/api/album').set(authHeader(sharedMember.email));
    expect(res.status).toBe(200);
    expect(res.body.data.some((a: { title: string }) => a.title === `${T}ScopeShared`)).toBe(true);
  });

  it('an admin sees albums across all collections', async () => {
    await prisma.album.create({ data: { collectionId: otherCollectionId, title: `${T}AdminSeesAll` } });
    const res = await request(app).get('/api/album').set(authHeader(admin.email));
    expect(res.status).toBe(200);
    expect(res.body.data.some((a: { title: string }) => a.title === `${T}AdminSeesAll`)).toBe(true);
  });
});

// ── GET /api/album/:id ───────────────────────────────────────────────────

describe('GET /api/album/:id', () => {
  it('returns 200 with album and its artists', async () => {
    const album = await prisma.album.create({ data: { collectionId, title: `${T}GetById` } });
    await prisma.album_artist.create({ data: { albumId: album.id, artistId } });
    const res = await request(app).get(`/api/album/${album.id}`).set(authHeader(owner.email));
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(album.id);
    expect(res.body.data.artists.some((a: { id: string }) => a.id === artistId)).toBe(true);
  });

  it('a shared member can view the album', async () => {
    const album = await prisma.album.create({ data: { collectionId, title: `${T}SharedView` } });
    const res = await request(app).get(`/api/album/${album.id}`).set(authHeader(sharedMember.email));
    expect(res.status).toBe(200);
  });

  it('returns 404 for an outsider (masks existence)', async () => {
    const album = await prisma.album.create({ data: { collectionId, title: `${T}HiddenFromOutsider` } });
    const res = await request(app).get(`/api/album/${album.id}`).set(authHeader(outsider.email));
    expect(res.status).toBe(404);
  });

  it('returns 404 with data:null for a nonexistent id', async () => {
    const res = await request(app)
      .get('/api/album/00000000-0000-0000-0000-000000000000')
      .set(authHeader(owner.email));
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
  });

  it('includes copy rows with resolved location (#5)', async () => {
    const album = await prisma.album.create({ data: { collectionId, title: `${T}WithCopies` } });
    const room = await prisma.location.create({ data: { name: `${T}CopyRoom`, kind: 'physical' } });
    const shelf = await prisma.location.create({
      data: { name: `${T}CopyShelf`, kind: 'physical', parentLocationId: room.id },
    });
    await prisma.copy.create({ data: { albumId: album.id, locationId: shelf.id } });

    const res = await request(app).get(`/api/album/${album.id}`).set(authHeader(owner.email));
    expect(res.status).toBe(200);
    expect(res.body.data.copies).toHaveLength(1);
    expect(res.body.data.copies[0].location.id).toBe(shelf.id);
    expect(res.body.data.copies[0].location.parent.id).toBe(room.id);
  });
});

// ── PATCH /api/album/:id ─────────────────────────────────────────────────

describe('PATCH /api/album/:id', () => {
  it('updates album fields', async () => {
    const album = await prisma.album.create({ data: { collectionId, title: `${T}ToUpdate` } });
    const res = await request(app)
      .patch(`/api/album/${album.id}`)
      .set(authHeader(owner.email))
      .send({ title: `${T}Updated`, year: 1999 });
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe(`${T}Updated`);
    expect(res.body.data.year).toBe(1999);
  });

  it('replaces artistIds', async () => {
    const album = await prisma.album.create({ data: { collectionId, title: `${T}ReplaceArtists` } });
    await prisma.album_artist.create({ data: { albumId: album.id, artistId } });
    const res = await request(app)
      .patch(`/api/album/${album.id}`)
      .set(authHeader(owner.email))
      .send({ artistIds: [otherArtistId] });
    expect(res.status).toBe(200);
    expect(res.body.data.artists.map((a: { id: string }) => a.id)).toEqual([otherArtistId]);
  });

  it('returns 404 for an outsider', async () => {
    const album = await prisma.album.create({ data: { collectionId, title: `${T}NotYoursToEdit` } });
    const res = await request(app)
      .patch(`/api/album/${album.id}`)
      .set(authHeader(outsider.email))
      .send({ title: `${T}ShouldFail` });
    expect(res.status).toBe(404);
  });

  it('returns 404 for a nonexistent id', async () => {
    const res = await request(app)
      .patch('/api/album/00000000-0000-0000-0000-000000000000')
      .set(authHeader(owner.email))
      .send({ title: `${T}Nope` });
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
  });
});

// ── DELETE /api/album/:id ────────────────────────────────────────────────

describe('DELETE /api/album/:id', () => {
  it('deletes an existing album', async () => {
    const album = await prisma.album.create({ data: { collectionId, title: `${T}ToDelete` } });
    const res = await request(app).delete(`/api/album/${album.id}`).set(authHeader(owner.email));
    expect(res.status).toBe(200);

    const check = await request(app).get(`/api/album/${album.id}`).set(authHeader(owner.email));
    expect(check.status).toBe(404);
  });

  it('an admin can delete albums in any collection', async () => {
    const album = await prisma.album.create({ data: { collectionId, title: `${T}AdminDelete` } });
    const res = await request(app).delete(`/api/album/${album.id}`).set(authHeader(admin.email));
    expect(res.status).toBe(200);
  });

  it('returns 404 for an outsider', async () => {
    const album = await prisma.album.create({ data: { collectionId, title: `${T}NotYoursToDelete` } });
    const res = await request(app).delete(`/api/album/${album.id}`).set(authHeader(outsider.email));
    expect(res.status).toBe(404);
  });

  it('returns 404 for a nonexistent id', async () => {
    const res = await request(app)
      .delete('/api/album/00000000-0000-0000-0000-000000000000')
      .set(authHeader(owner.email));
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
  });
});
