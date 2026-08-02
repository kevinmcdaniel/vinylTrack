import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../database.js';
import { T, cleanupTestData } from './setup.js';

let collectionId: string;
let otherCollectionId: string;
let artistId: string;
let otherArtistId: string;

beforeAll(async () => {
  await cleanupTestData();
  const owner = await prisma.user.create({ data: { email: `${T}album-owner@example.com`, status: 'active' } });
  const collection = await prisma.collection.create({ data: { name: `${T}AlbumColl`, kind: 'physical', ownerId: owner.id } });
  const other = await prisma.collection.create({ data: { name: `${T}OtherColl`, kind: 'digital', ownerId: owner.id } });
  collectionId = collection.id;
  otherCollectionId = other.id;
  const artist = await prisma.artist.create({ data: { name: `${T}AlbumArtist` } });
  const otherArtist = await prisma.artist.create({ data: { name: `${T}OtherArtist` } });
  artistId = artist.id;
  otherArtistId = otherArtist.id;
});
afterAll(async () => { await cleanupTestData(); });

// ── POST /api/album ──────────────────────────────────────────────────────

describe('POST /api/album', () => {
  it('creates an album with collectionId + title only', async () => {
    const res = await request(app).post('/api/album').send({ collectionId, title: `${T}NewAlbum` });
    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe(`${T}NewAlbum`);
    expect(res.body.data.collectionId).toBe(collectionId);
  });

  it('creates an album with artistIds, writing album_artist rows', async () => {
    const res = await request(app)
      .post('/api/album')
      .send({ collectionId, title: `${T}CreditedAlbum`, artistIds: [artistId, otherArtistId] });
    expect(res.status).toBe(201);
    expect(res.body.data.artists).toBeInstanceOf(Array);
    expect(res.body.data.artists.map((a: { id: string }) => a.id).sort()).toEqual([artistId, otherArtistId].sort());
  });

  it('returns 406 when title is missing', async () => {
    const res = await request(app).post('/api/album').send({ collectionId });
    expect(res.status).toBe(406);
  });

  it('returns 406 when collectionId is missing', async () => {
    const res = await request(app).post('/api/album').send({ title: `${T}NoColl` });
    expect(res.status).toBe(406);
  });

  it('returns 409 for a nonexistent collectionId', async () => {
    const res = await request(app)
      .post('/api/album')
      .send({ collectionId: '00000000-0000-0000-0000-000000000000', title: `${T}BadColl` });
    expect(res.status).toBe(409);
  });
});

// ── GET /api/album ───────────────────────────────────────────────────────

describe('GET /api/album', () => {
  it('returns 200 with [] when no albums match', async () => {
    const res = await request(app).get('/api/album?format=zzznomatch');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('filters by collectionId', async () => {
    await prisma.album.create({ data: { collectionId, title: `${T}InColl` } });
    await prisma.album.create({ data: { collectionId: otherCollectionId, title: `${T}InOtherColl` } });
    const res = await request(app).get(`/api/album?collectionId=${collectionId}`);
    expect(res.status).toBe(200);
    const titles = res.body.data.map((a: { title: string }) => a.title);
    expect(titles).toContain(`${T}InColl`);
    expect(titles).not.toContain(`${T}InOtherColl`);
  });

  it('filters by artistId', async () => {
    const album = await prisma.album.create({ data: { collectionId, title: `${T}ByArtist` } });
    await prisma.album_artist.create({ data: { albumId: album.id, artistId } });
    const res = await request(app).get(`/api/album?artistId=${artistId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.some((a: { id: string }) => a.id === album.id)).toBe(true);
  });

  it('filters by format and genre', async () => {
    await prisma.album.create({ data: { collectionId, title: `${T}FormatMatch`, format: 'LP', genre: 'Jazz' } });
    const res = await request(app).get('/api/album?format=LP&genre=Jazz');
    expect(res.status).toBe(200);
    expect(res.body.data.some((a: { title: string }) => a.title === `${T}FormatMatch`)).toBe(true);
  });
});

// ── GET /api/album/:id ───────────────────────────────────────────────────

describe('GET /api/album/:id', () => {
  it('returns 200 with album and its artists', async () => {
    const album = await prisma.album.create({ data: { collectionId, title: `${T}GetById` } });
    await prisma.album_artist.create({ data: { albumId: album.id, artistId } });
    const res = await request(app).get(`/api/album/${album.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(album.id);
    expect(res.body.data.artists.some((a: { id: string }) => a.id === artistId)).toBe(true);
  });

  it('returns 404 with data:null for a nonexistent id', async () => {
    const res = await request(app).get('/api/album/00000000-0000-0000-0000-000000000000');
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

    const res = await request(app).get(`/api/album/${album.id}`);
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
    const res = await request(app).patch(`/api/album/${album.id}`).send({ title: `${T}Updated`, year: 1999 });
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe(`${T}Updated`);
    expect(res.body.data.year).toBe(1999);
  });

  it('replaces artistIds', async () => {
    const album = await prisma.album.create({ data: { collectionId, title: `${T}ReplaceArtists` } });
    await prisma.album_artist.create({ data: { albumId: album.id, artistId } });
    const res = await request(app).patch(`/api/album/${album.id}`).send({ artistIds: [otherArtistId] });
    expect(res.status).toBe(200);
    expect(res.body.data.artists.map((a: { id: string }) => a.id)).toEqual([otherArtistId]);
  });

  it('returns 404 for a nonexistent id', async () => {
    const res = await request(app)
      .patch('/api/album/00000000-0000-0000-0000-000000000000')
      .send({ title: `${T}Nope` });
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
  });
});

// ── DELETE /api/album/:id ────────────────────────────────────────────────

describe('DELETE /api/album/:id', () => {
  it('deletes an existing album', async () => {
    const album = await prisma.album.create({ data: { collectionId, title: `${T}ToDelete` } });
    const res = await request(app).delete(`/api/album/${album.id}`);
    expect(res.status).toBe(200);

    const check = await request(app).get(`/api/album/${album.id}`);
    expect(check.status).toBe(404);
  });

  it('returns 404 for a nonexistent id', async () => {
    const res = await request(app).delete('/api/album/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
  });
});
