import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../database.js';
import { T, cleanupTestData, authHeader, createTestAdmin } from './setup.js';

// Collection settings (#125): rename, and share with specific family members.
// Owner or admin only; a shared member gets 403 (they can see the collection),
// anyone else 404 (existence masked, as everywhere else).
let owner: { id: string; email: string };
let member: { id: string; email: string };
let outsider: { id: string; email: string };
let pending: { id: string; email: string };
let admin: { id: string; email: string };
let collectionId: string;

beforeAll(async () => {
  await cleanupTestData();
  owner = await prisma.user.create({ data: { email: `${T}set-owner@example.com`, name: `${T}Owner`, status: 'active' } });
  member = await prisma.user.create({ data: { email: `${T}set-member@example.com`, name: `${T}Member`, status: 'active' } });
  outsider = await prisma.user.create({ data: { email: `${T}set-outsider@example.com`, name: `${T}Outsider`, status: 'active' } });
  pending = await prisma.user.create({ data: { email: `${T}set-pending@example.com`, status: 'pending' } });
  admin = await createTestAdmin('set-admin');
  collectionId = (await prisma.collection.create({ data: { name: `${T}SetColl`, kind: 'physical', ownerId: owner.id } })).id;
  await prisma.collection_share.create({ data: { collectionId, userId: member.id, role: 'full' } });
});
afterAll(async () => { await cleanupTestData(); });

const as = (who: { email: string }) => authHeader(who.email);

describe('collection owner', () => {
  it('rides on GET /api/collection/:id as { id, name }, never an email', async () => {
    const res = await request(app).get(`/api/collection/${collectionId}`).set(as(member));
    expect(res.status).toBe(200);
    expect(res.body.data.owner).toEqual({ id: owner.id, name: `${T}Owner` });
  });

  it('rides on the list too', async () => {
    const res = await request(app).get('/api/collection').set(as(member));
    const row = res.body.data.find((c: { id: string }) => c.id === collectionId);
    expect(row.owner).toEqual({ id: owner.id, name: `${T}Owner` });
  });
});

describe('PATCH /api/collection/:id', () => {
  it('renames and re-notes for the owner', async () => {
    const res = await request(app).patch(`/api/collection/${collectionId}`).set(as(owner)).send({ name: ` ${T}Renamed `, notes: 'Dad’s' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ name: `${T}Renamed`, notes: 'Dad’s', kind: 'physical' });
  });

  it('lets an admin rename, and null clears notes', async () => {
    const res = await request(app).patch(`/api/collection/${collectionId}`).set(as(admin)).send({ notes: null });
    expect(res.status).toBe(200);
    expect(res.body.data.notes).toBeNull();
  });

  it.each([
    ['a blank name', { name: '  ' }],
    ['a non-string name', { name: 42 }],
    ['a kind change', { kind: 'digital' }],
    ['an ownerId', { ownerId: 'someone' }],
  ])('returns 406 for %s', async (_case, body) => {
    const res = await request(app).patch(`/api/collection/${collectionId}`).set(as(owner)).send(body);
    expect(res.status).toBe(406);
  });

  it('returns 403 to a shared member and 404 to an outsider', async () => {
    expect((await request(app).patch(`/api/collection/${collectionId}`).set(as(member)).send({ name: 'x' })).status).toBe(403);
    expect((await request(app).patch(`/api/collection/${collectionId}`).set(as(outsider)).send({ name: 'x' })).status).toBe(404);
    expect((await request(app).patch('/api/collection/00000000-0000-0000-0000-000000000000').set(as(owner)).send({ name: 'x' })).status).toBe(404);
  });
});

describe('collection shares', () => {
  const sharesUrl = () => `/api/collection/${collectionId}/share`;

  it('lists who it is shared with, by name and email', async () => {
    const res = await request(app).get(sharesUrl()).set(as(owner));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ id: member.id, name: `${T}Member`, email: member.email }]);
  });

  it('offers active users who are neither the owner nor already shared', async () => {
    const res = await request(app).get(`${sharesUrl()}/candidates`).set(as(owner));
    expect(res.status).toBe(200);
    const ids = res.body.data.map((u: { id: string }) => u.id);
    expect(ids).toContain(outsider.id);
    expect(ids).not.toContain(owner.id);
    expect(ids).not.toContain(member.id);
    expect(ids).not.toContain(pending.id);
    expect(res.body.data.find((u: { id: string }) => u.id === outsider.id)).toEqual({ id: outsider.id, name: `${T}Outsider`, email: outsider.email });
  });

  it('shares with a user, who then sees the collection', async () => {
    const res = await request(app).post(sharesUrl()).set(as(owner)).send({ userId: outsider.id });
    expect(res.status).toBe(201);
    const seen = await request(app).get(`/api/collection/${collectionId}`).set(as(outsider));
    expect(seen.status).toBe(200);
  });

  it.each([
    ['a duplicate share', () => ({ userId: member.id }), 409],
    ['the owner', () => ({ userId: owner.id }), 406],
    ['a pending user', () => ({ userId: pending.id }), 406],
    ['no such user', () => ({ userId: '00000000-0000-0000-0000-000000000000' }), 406],
    ['no userId', () => ({}), 406],
    ['an extra field', () => ({ userId: member.id, role: 'full' }), 406],
  ])('refuses %s', async (_case, body, status) => {
    const res = await request(app).post(sharesUrl()).set(as(owner)).send(body());
    expect(res.status).toBe(status);
  });

  it('stops sharing, effective on the next request', async () => {
    const res = await request(app).delete(`${sharesUrl()}/${outsider.id}`).set(as(owner));
    expect(res.status).toBe(200);
    expect((await request(app).get(`/api/collection/${collectionId}`).set(as(outsider))).status).toBe(404);
    expect((await request(app).delete(`${sharesUrl()}/${outsider.id}`).set(as(owner))).status).toBe(404);
  });

  it('keeps every share route from a shared member (403) and an outsider (404)', async () => {
    for (const [who, status] of [[member, 403], [outsider, 404]] as const) {
      expect((await request(app).get(sharesUrl()).set(as(who))).status).toBe(status);
      expect((await request(app).get(`${sharesUrl()}/candidates`).set(as(who))).status).toBe(status);
      expect((await request(app).post(sharesUrl()).set(as(who)).send({ userId: pending.id })).status).toBe(status);
      expect((await request(app).delete(`${sharesUrl()}/${member.id}`).set(as(who))).status).toBe(status);
    }
  });

  it('lets an admin manage shares of a collection they do not own', async () => {
    expect((await request(app).get(sharesUrl()).set(as(admin))).status).toBe(200);
  });
});
