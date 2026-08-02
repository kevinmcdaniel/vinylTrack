import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../database.js';
import { T, cleanupTestData } from './setup.js';

let collectionId: string;
let albumId: string;
let locationId: string;
let sourceId: string;

beforeAll(async () => {
  await cleanupTestData();
  const owner = await prisma.user.create({ data: { email: `${T}copy-owner@example.com`, status: 'active' } });
  const collection = await prisma.collection.create({ data: { name: `${T}CopyColl`, kind: 'physical', ownerId: owner.id } });
  collectionId = collection.id;
  const album = await prisma.album.create({ data: { collectionId, title: `${T}CopyAlbum` } });
  albumId = album.id;
  const location = await prisma.location.create({ data: { name: `${T}CopyLoc`, kind: 'physical' } });
  locationId = location.id;
  const source = await prisma.source.create({ data: { type: 'store', name: `${T}CopyStore` } });
  sourceId = source.id;
});
afterAll(async () => { await cleanupTestData(); });

// ── POST /api/copy ────────────────────────────────────────────────────────

describe('POST /api/copy', () => {
  it('creates a copy with albumId + locationId only', async () => {
    const res = await request(app).post('/api/copy').send({ albumId, locationId });
    expect(res.status).toBe(201);
    expect(res.body.data.albumId).toBe(albumId);
    expect(res.body.data.locationId).toBe(locationId);
  });

  it('creates a copy with source + acquisition fields', async () => {
    const res = await request(app)
      .post('/api/copy')
      .send({ albumId, locationId, sourceId, price: 24.99, condition: 'VG+', notes: 'test' });
    expect(res.status).toBe(201);
    expect(res.body.data.sourceId).toBe(sourceId);
    expect(res.body.data.condition).toBe('VG+');
  });

  it('returns 406 when albumId is missing', async () => {
    const res = await request(app).post('/api/copy').send({ locationId });
    expect(res.status).toBe(406);
  });

  it('returns 406 when locationId is missing', async () => {
    const res = await request(app).post('/api/copy').send({ albumId });
    expect(res.status).toBe(406);
  });

  it('returns 409 for a nonexistent albumId', async () => {
    const res = await request(app)
      .post('/api/copy')
      .send({ albumId: '00000000-0000-0000-0000-000000000000', locationId });
    expect(res.status).toBe(409);
  });
});

// ── GET /api/copy ─────────────────────────────────────────────────────────

describe('GET /api/copy', () => {
  it('filters by albumId', async () => {
    const copy = await prisma.copy.create({ data: { albumId, locationId } });
    const res = await request(app).get(`/api/copy?albumId=${albumId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.some((c: { id: string }) => c.id === copy.id)).toBe(true);
  });

  it('returns 200 with [] when no copies match', async () => {
    const res = await request(app).get('/api/copy?albumId=00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

// ── GET /api/copy/:id ─────────────────────────────────────────────────────

describe('GET /api/copy/:id', () => {
  it('returns 200 with copy and resolved location', async () => {
    const copy = await prisma.copy.create({ data: { albumId, locationId, sourceId } });
    const res = await request(app).get(`/api/copy/${copy.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.location.id).toBe(locationId);
    expect(res.body.data.source.id).toBe(sourceId);
  });

  it('returns 404 with data:null for a nonexistent id', async () => {
    const res = await request(app).get('/api/copy/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
  });
});

// ── PATCH /api/copy/:id ───────────────────────────────────────────────────

describe('PATCH /api/copy/:id', () => {
  it('updates a copy', async () => {
    const copy = await prisma.copy.create({ data: { albumId, locationId } });
    const res = await request(app).patch(`/api/copy/${copy.id}`).send({ condition: 'M' });
    expect(res.status).toBe(200);
    expect(res.body.data.condition).toBe('M');
  });

  it('returns 404 for a nonexistent id', async () => {
    const res = await request(app)
      .patch('/api/copy/00000000-0000-0000-0000-000000000000')
      .send({ condition: 'M' });
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
  });
});

// ── DELETE /api/copy/:id ──────────────────────────────────────────────────

describe('DELETE /api/copy/:id', () => {
  it('deletes an existing copy', async () => {
    const copy = await prisma.copy.create({ data: { albumId, locationId } });
    const res = await request(app).delete(`/api/copy/${copy.id}`);
    expect(res.status).toBe(200);

    const check = await request(app).get(`/api/copy/${copy.id}`);
    expect(check.status).toBe(404);
  });

  it('returns 404 for a nonexistent id', async () => {
    const res = await request(app).delete('/api/copy/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
    expect(res.body.data).toBeNull();
  });
});
