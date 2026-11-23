import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../database.js';
import { T, cleanupTestData, authHeader } from './setup.js';

// What's in a location (#126): GET /api/copy?locationId=&includeSublocations=true
// lists the copies there and in every location inside it, each with its album.
let owner: { id: string; email: string };
let outsider: { id: string; email: string };
let basement: string;
let shelf: string;
let bin: string;
let elsewhere: string;
const copyIds: Record<string, string> = {};

beforeAll(async () => {
  await cleanupTestData();
  owner = await prisma.user.create({ data: { email: `${T}lc-owner@example.com`, status: 'active' } });
  outsider = await prisma.user.create({ data: { email: `${T}lc-outsider@example.com`, status: 'active' } });
  const collectionId = (await prisma.collection.create({ data: { name: `${T}LcColl`, kind: 'physical', ownerId: owner.id } })).id;
  const ownerRow = (await prisma.owner.create({ data: { name: `${T}LcOwner` } })).id;
  const artist = await prisma.artist.create({ data: { name: `${T}LcArtist` } });
  const loc = (name: string, parentLocationId?: string) =>
    prisma.location.create({ data: { name: `${T}${name}`, kind: 'physical', collectionId, parentLocationId } }).then((l) => l.id);
  basement = await loc('LcBasement');
  shelf = await loc('LcShelf', basement);
  bin = await loc('LcBin', shelf);
  elsewhere = await loc('LcAttic');
  const album = (title: string) => prisma.album.create({
    data: { collectionId, title: `${T}${title}`, format: 'LP', artists: { create: [{ artistId: artist.id }] } },
  }).then((a) => a.id);
  const [blue, train, spain, attic] = await Promise.all([album('LcBlue'), album('LcTrain'), album('LcSpain'), album('LcAtticAlbum')]);
  const copy = (key: string, albumId: string, locationId: string) =>
    prisma.copy.create({ data: { albumId, locationId, ownerId: ownerRow } }).then((c) => { copyIds[key] = c.id; });
  await copy('inBasement', blue, basement);
  await copy('onShelf', train, shelf);
  await copy('inBin', spain, bin);
  await copy('inAttic', attic, elsewhere);
});
afterAll(async () => { await cleanupTestData(); });

const contents = (who: { email: string }, query: string) =>
  request(app).get(`/api/copy?${query}`).set(authHeader(who.email));

describe('GET /api/copy?locationId= (#126)', () => {
  it('lists only that location without includeSublocations, as before', async () => {
    const res = await contents(owner, `locationId=${shelf}`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((c: { id: string }) => c.id)).toEqual([copyIds.onShelf]);
  });

  it('includes every location inside it, and nothing outside', async () => {
    const res = await contents(owner, `locationId=${basement}&includeSublocations=true`);
    expect(res.status).toBe(200);
    const ids = res.body.data.map((c: { id: string }) => c.id);
    expect(ids.sort()).toEqual([copyIds.inBasement, copyIds.onShelf, copyIds.inBin].sort());
    expect(ids).not.toContain(copyIds.inAttic);
  });

  it('carries each copy’s album with its artists, flattened', async () => {
    const res = await contents(owner, `locationId=${bin}&includeSublocations=true`);
    expect(res.body.data[0].album).toMatchObject({ title: `${T}LcSpain`, format: 'LP', artists: [{ name: `${T}LcArtist` }] });
  });

  it('orders by location, then album title', async () => {
    const res = await contents(owner, `locationId=${basement}&includeSublocations=true`);
    expect(res.body.data.map((c: { album: { title: string } }) => c.album.title))
      .toEqual([`${T}LcBlue`, `${T}LcTrain`, `${T}LcSpain`]);
  });

  it('answers an outsider an empty list, sub-locations and all', async () => {
    const res = await contents(outsider, `locationId=${basement}&includeSublocations=true`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it.each([
    ['a repeated locationId', `locationId=${'a'}&locationId=${'b'}`],
    ['a repeated includeSublocations', `locationId=x&includeSublocations=true&includeSublocations=true`],
    ['includeSublocations without a locationId', `includeSublocations=true`],
  ])('returns 406 for %s', async (_case, query) => {
    expect((await contents(owner, query)).status).toBe(406);
  });
});
