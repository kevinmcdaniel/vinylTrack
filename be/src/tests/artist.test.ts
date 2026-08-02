import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../database.js';
import { T, cleanupTestData } from './setup.js';

beforeAll(async () => { await cleanupTestData(); });
afterAll(async () => { await cleanupTestData(); });

// ── POST /api/artist ─────────────────────────────────────────────────────

describe('POST /api/artist', () => {
  it('creates an artist with name only', async () => {
    const res = await request(app).post('/api/artist').send({ name: `${T}NewArtist` });
    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe(`${T}NewArtist`);
    expect(res.body.data.id).toBeDefined();
  });

  it('creates an artist with optional fields', async () => {
    const res = await request(app)
      .post('/api/artist')
      .send({ name: `${T}FullArtist`, sortName: `${T}Sort`, notes: 'test notes' });
    expect(res.status).toBe(201);
    expect(res.body.data.sortName).toBe(`${T}Sort`);
    expect(res.body.data.notes).toBe('test notes');
  });

  it('returns 406 when name is missing', async () => {
    const res = await request(app).post('/api/artist').send({});
    expect(res.status).toBe(406);
  });
});

// ── GET /api/artist ──────────────────────────────────────────────────────

describe('GET /api/artist', () => {
  it('returns 200 with an array when artists exist', async () => {
    await prisma.artist.create({ data: { name: `${T}ListCheck` } });
    const res = await request(app).get('/api/artist');
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.some((a: { name: string }) => a.name === `${T}ListCheck`)).toBe(true);
  });

  it('returns 200 with [] when no artists match (never null)', async () => {
    await cleanupTestData();
    const res = await request(app).get('/api/artist');
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
  });
});

// ── GET /api/artist/:id ──────────────────────────────────────────────────

describe('GET /api/artist/:id', () => {
  it('returns 200 with artist when id exists', async () => {
    const artist = await prisma.artist.create({ data: { name: `${T}GetById` } });
    const res = await request(app).get(`/api/artist/${artist.id}`);
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

    const res = await request(app).get(`/api/artist/${artist.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.albums).toBeInstanceOf(Array);
    expect(res.body.data.albums.some((a: { id: string }) => a.id === album.id)).toBe(true);
  });

  it('returns 404 with data:null for a nonexistent id', async () => {
    const res = await request(app).get('/api/artist/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
  });
});

// ── PATCH /api/artist/:id ─────────────────────────────────────────────────

describe('PATCH /api/artist/:id', () => {
  it('updates an existing artist', async () => {
    const artist = await prisma.artist.create({ data: { name: `${T}ToUpdate` } });
    const res = await request(app).patch(`/api/artist/${artist.id}`).send({ name: `${T}Updated` });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe(`${T}Updated`);
  });

  it('returns 404 for a nonexistent id', async () => {
    const res = await request(app)
      .patch('/api/artist/00000000-0000-0000-0000-000000000000')
      .send({ name: `${T}Nope` });
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
  });
});

// ── DELETE /api/artist/:id ─────────────────────────────────────────────────

describe('DELETE /api/artist/:id', () => {
  it('deletes an existing artist', async () => {
    const artist = await prisma.artist.create({ data: { name: `${T}ToDelete` } });
    const res = await request(app).delete(`/api/artist/${artist.id}`);
    expect(res.status).toBe(200);

    const check = await request(app).get(`/api/artist/${artist.id}`);
    expect(check.status).toBe(404);
  });

  it('returns 404 for a nonexistent id', async () => {
    const res = await request(app).delete('/api/artist/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
  });
});
