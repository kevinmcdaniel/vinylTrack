import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../database.js';
import { T, cleanupTestData, authHeader, createTestAdmin } from './setup.js';

let admin: { email: string };
let member: { email: string };

beforeAll(async () => {
  await cleanupTestData();
  admin = await createTestAdmin();
  member = await prisma.user.create({ data: { email: `${T}member@example.com`, status: 'active' } });
});
afterAll(async () => { await cleanupTestData(); });

// ── auth baseline ────────────────────────────────────────────────────────

describe('auth (#26)', () => {
  it('returns 401 for an unrecognized identity', async () => {
    const res = await request(app).get('/api/artist').set(authHeader(`${T}nobody@example.com`));
    expect(res.status).toBe(401);
    expect(res.body.data).toBeNull();
  });
});

// ── POST /api/artist ─────────────────────────────────────────────────────

describe('POST /api/artist', () => {
  it('creates an artist with name only', async () => {
    const res = await request(app).post('/api/artist').set(authHeader(member.email)).send({ name: `${T}NewArtist` });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe(`${T}NewArtist`);
    expect(res.body.data.id).toBeDefined();
  });

  it('creates an artist with optional fields', async () => {
    const res = await request(app)
      .post('/api/artist')
      .set(authHeader(member.email))
      .send({ name: `${T}FullArtist`, sortName: `${T}Sort`, notes: 'test notes' });
    expect(res.status).toBe(201);
    expect(res.body.data.sortName).toBe(`${T}Sort`);
    expect(res.body.data.notes).toBe('test notes');
  });

  it('returns 406 when name is missing', async () => {
    const res = await request(app).post('/api/artist').set(authHeader(member.email)).send({});
    expect(res.status).toBe(406);
  });
});

// ── GET /api/artist ──────────────────────────────────────────────────────

describe('GET /api/artist', () => {
  it('returns 200 with an array when artists exist', async () => {
    await prisma.artist.create({ data: { name: `${T}ListCheck` } });
    const res = await request(app).get('/api/artist').set(authHeader(member.email));
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.some((a: { name: string }) => a.name === `${T}ListCheck`)).toBe(true);
  });
});

// ── GET /api/artist/:id ──────────────────────────────────────────────────

describe('GET /api/artist/:id', () => {
  it('returns 200 with artist when id exists', async () => {
    const artist = await prisma.artist.create({ data: { name: `${T}GetById` } });
    const res = await request(app).get(`/api/artist/${artist.id}`).set(authHeader(member.email));
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(artist.id);
    expect(res.body.data.name).toBe(`${T}GetById`);
  });

  it('includes linked albums (#3)', async () => {
    const artist = await prisma.artist.create({ data: { name: `${T}Contributor` } });
    const owner = await prisma.user.create({ data: { email: `${T}owner@example.com`, status: 'active' } });
    const collection = await prisma.collection.create({ data: { name: `${T}Coll`, kind: 'physical', ownerId: owner.id } });
    const album = await prisma.album.create({ data: { collectionId: collection.id, title: `${T}Album` } });
    await prisma.album_artist.create({ data: { albumId: album.id, artistId: artist.id } });

    // Queried as the collection's owner: linked albums are scoped to the
    // caller's accessible collections (#33), so `member` would correctly see none.
    const res = await request(app).get(`/api/artist/${artist.id}`).set(authHeader(owner.email));
    expect(res.status).toBe(200);
    expect(res.body.data.albums).toBeInstanceOf(Array);
    expect(res.body.data.albums.some((a: { id: string }) => a.id === album.id)).toBe(true);
  });

  it('returns 404 with data:null for a nonexistent id', async () => {
    const res = await request(app)
      .get('/api/artist/00000000-0000-0000-0000-000000000000')
      .set(authHeader(member.email));
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
  });
});

// ── PATCH /api/artist/:id ─────────────────────────────────────────────────

describe('PATCH /api/artist/:id', () => {
  it('updates an existing artist', async () => {
    const artist = await prisma.artist.create({ data: { name: `${T}ToUpdate` } });
    const res = await request(app)
      .patch(`/api/artist/${artist.id}`)
      .set(authHeader(member.email))
      .send({ name: `${T}Updated` });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe(`${T}Updated`);
  });

  it('returns 404 for a nonexistent id', async () => {
    const res = await request(app)
      .patch('/api/artist/00000000-0000-0000-0000-000000000000')
      .set(authHeader(member.email))
      .send({ name: `${T}Nope` });
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
  });
});

// ── DELETE /api/artist/:id ─────────────────────────────────────────────────

describe('DELETE /api/artist/:id', () => {
  it('deletes an existing artist as admin', async () => {
    const artist = await prisma.artist.create({ data: { name: `${T}ToDelete` } });
    const res = await request(app).delete(`/api/artist/${artist.id}`).set(authHeader(admin.email));
    expect(res.status).toBe(200);

    const check = await request(app).get(`/api/artist/${artist.id}`).set(authHeader(admin.email));
    expect(check.status).toBe(404);
  });

  it('returns 403 for a non-admin member', async () => {
    const artist = await prisma.artist.create({ data: { name: `${T}NotYours` } });
    const res = await request(app).delete(`/api/artist/${artist.id}`).set(authHeader(member.email));
    expect(res.status).toBe(403);
  });

  it('returns 404 for a nonexistent id', async () => {
    const res = await request(app)
      .delete('/api/artist/00000000-0000-0000-0000-000000000000')
      .set(authHeader(admin.email));
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
  });
});

// ── GET /api/artist/:id — album scoping (#33) ─────────────────────────────

describe('GET /api/artist/:id album scoping', () => {
  let artistId: string;
  let accessibleAlbumId: string;
  let hiddenAlbumId: string;
  let collOwner: { id: string; email: string };
  let shared: { id: string; email: string };
  let outsider: { id: string; email: string };
  let scopeAdmin: { id: string; email: string };

  beforeAll(async () => {
    collOwner = await prisma.user.create({ data: { email: `${T}scope-owner@example.com`, status: 'active' } });
    shared = await prisma.user.create({ data: { email: `${T}scope-shared@example.com`, status: 'active' } });
    outsider = await prisma.user.create({ data: { email: `${T}scope-outsider@example.com`, status: 'active' } });
    scopeAdmin = await createTestAdmin('scope-admin');

    const openColl = await prisma.collection.create({
      data: { name: `${T}ScopeShared`, kind: 'physical', ownerId: collOwner.id },
    });
    const closedColl = await prisma.collection.create({
      data: { name: `${T}ScopeClosed`, kind: 'physical', ownerId: collOwner.id },
    });
    await prisma.collection_share.create({ data: { collectionId: openColl.id, userId: shared.id, role: 'full' } });

    const artist = await prisma.artist.create({ data: { name: `${T}ScopedArtist` } });
    artistId = artist.id;
    const accessible = await prisma.album.create({ data: { collectionId: openColl.id, title: `${T}VisibleAlbum` } });
    const hidden = await prisma.album.create({ data: { collectionId: closedColl.id, title: `${T}HiddenAlbum` } });
    accessibleAlbumId = accessible.id;
    hiddenAlbumId = hidden.id;
    await prisma.album_artist.create({ data: { albumId: accessible.id, artistId: artist.id } });
    await prisma.album_artist.create({ data: { albumId: hidden.id, artistId: artist.id } });
  });

  const albumIds = (body: { data: { albums: { id: string }[] } }) => body.data.albums.map((a) => a.id);

  it('does not leak albums from collections the caller cannot access', async () => {
    const res = await request(app).get(`/api/artist/${artistId}`).set(authHeader(outsider.email));
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe(`${T}ScopedArtist`);
    expect(res.body.data.albums).toEqual([]);
  });

  it('shows a shared member only the album in the collection shared with them', async () => {
    const res = await request(app).get(`/api/artist/${artistId}`).set(authHeader(shared.email));
    expect(res.status).toBe(200);
    expect(albumIds(res.body)).toEqual([accessibleAlbumId]);
  });

  it('shows the collection owner both of their own albums', async () => {
    const res = await request(app).get(`/api/artist/${artistId}`).set(authHeader(collOwner.email));
    expect(albumIds(res.body).sort()).toEqual([accessibleAlbumId, hiddenAlbumId].sort());
  });

  it('an admin sees albums across all collections', async () => {
    const res = await request(app).get(`/api/artist/${artistId}`).set(authHeader(scopeAdmin.email));
    expect(albumIds(res.body).sort()).toEqual([accessibleAlbumId, hiddenAlbumId].sort());
  });

  it('labels each album with the collection it belongs to (#7)', async () => {
    const res = await request(app).get(`/api/artist/${artistId}`).set(authHeader(shared.email));
    const album = res.body.data.albums[0];
    expect(album.collection.name).toBe(`${T}ScopeShared`);
    expect(album.collection.id).toBeTruthy();
  });

  it('still resolves the artist row itself for a caller with no collection access', async () => {
    const lonely = await prisma.artist.create({ data: { name: `${T}UnlinkedArtist` } });
    const res = await request(app).get(`/api/artist/${lonely.id}`).set(authHeader(outsider.email));
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe(`${T}UnlinkedArtist`);
  });

  it('a non-admin can still PATCH an artist whose albums are all invisible to them', async () => {
    const res = await request(app)
      .patch(`/api/artist/${artistId}`)
      .set(authHeader(outsider.email))
      .send({ notes: 'still editable' });
    expect(res.status).toBe(200);
    expect(res.body.data.notes).toBe('still editable');
  });
});
