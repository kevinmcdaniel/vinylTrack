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
    const location = await prisma.location.create({ data: { name: `${T}FoundLoc1`, kind: 'physical' } });
    const want = await prisma.want_item.create({ data: { collectionId, albumId, priority: 'must-have' } });

    const res = await request(app)
      .post(`/api/want/${want.id}/found`)
      .set(authHeader(owner.email))
      .send({ locationId: location.id, price: 19.99 });
    expect(res.status).toBe(201);
    expect(res.body.data.copy.albumId).toBe(albumId);
    expect(res.body.data.copy.locationId).toBe(location.id);

    const check = await prisma.want_item.findUnique({ where: { id: want.id } });
    expect(check).toBeNull();
  });

  it('converts an artist-level want by linking an existing album, then removes the want', async () => {
    const location = await prisma.location.create({ data: { name: `${T}FoundLoc2`, kind: 'physical' } });
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
    const location = await prisma.location.create({ data: { name: `${T}FoundLoc3`, kind: 'physical' } });
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

  it('returns 406 when locationId is missing', async () => {
    const want = await prisma.want_item.create({ data: { collectionId, albumId, priority: 'must-have' } });
    const res = await request(app).post(`/api/want/${want.id}/found`).set(authHeader(owner.email)).send({});
    expect(res.status).toBe(406);
  });

  it('returns 406 for an artist-level want with no albumId or album payload', async () => {
    const location = await prisma.location.create({ data: { name: `${T}FoundLoc4`, kind: 'physical' } });
    const want = await prisma.want_item.create({ data: { collectionId, artistId, priority: 'must-have' } });
    const res = await request(app)
      .post(`/api/want/${want.id}/found`)
      .set(authHeader(owner.email))
      .send({ locationId: location.id });
    expect(res.status).toBe(406);
  });

  it('returns 404 for an outsider', async () => {
    const location = await prisma.location.create({ data: { name: `${T}FoundLoc6`, kind: 'physical' } });
    const want = await prisma.want_item.create({ data: { collectionId, albumId, priority: 'must-have' } });
    const res = await request(app)
      .post(`/api/want/${want.id}/found`)
      .set(authHeader(outsider.email))
      .send({ locationId: location.id });
    expect(res.status).toBe(404);
  });

  it('returns 404 for a nonexistent want id', async () => {
    const location = await prisma.location.create({ data: { name: `${T}FoundLoc5`, kind: 'physical' } });
    const res = await request(app)
      .post('/api/want/00000000-0000-0000-0000-000000000000/found')
      .set(authHeader(owner.email))
      .send({ locationId: location.id });
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
  });
});
