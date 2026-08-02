// Dev seed data for issue #2 — two users, two collections (one owned, one shared),
// a couple of artists/albums, a duplicate copy across two locations (what #13's
// duplicate-check feature will look for), and a want-list item.
//
// Wipe-and-replace: safe to re-run against a populated dev DB.

import { prisma } from '../database.js';

async function main() {
  await prisma.want_item.deleteMany();
  await prisma.copy.deleteMany();
  await prisma.album_artist.deleteMany();
  await prisma.album.deleteMany();
  await prisma.source.deleteMany();
  await prisma.location.deleteMany();
  await prisma.collection_share.deleteMany();
  await prisma.collection.deleteMany();
  await prisma.artist.deleteMany();
  await prisma.user.deleteMany();

  const kevin = await prisma.user.create({
    data: { email: 'kevin@example.com', name: 'Kevin', status: 'active', isAdmin: true },
  });
  const alex = await prisma.user.create({
    data: { email: 'alex@example.com', name: 'Alex', status: 'active' },
  });

  const vinyl = await prisma.collection.create({
    data: { name: 'Vinyl', kind: 'physical', ownerId: kevin.id },
  });
  const calls = await prisma.collection.create({
    data: { name: 'Square Dance Calls', kind: 'digital', ownerId: kevin.id },
  });
  await prisma.collection_share.create({
    data: { collectionId: vinyl.id, userId: alex.id, role: 'full' },
  });

  const basement = await prisma.location.create({
    data: { name: 'Basement', kind: 'physical', ownerId: kevin.id },
  });
  const shelf3 = await prisma.location.create({
    data: { name: 'Shelf 3', kind: 'physical', parentLocationId: basement.id, ownerId: kevin.id },
  });
  const alexRoom = await prisma.location.create({
    data: { name: "Alex's room", kind: 'physical', ownerId: alex.id },
  });
  const icloud = await prisma.location.create({
    data: { name: 'iCloud Drive/Music/SquareDance', kind: 'digital', ownerId: kevin.id },
  });

  const recordStore = await prisma.source.create({
    data: { type: 'store', name: 'Vinyl Vault' },
  });

  const milesDavis = await prisma.artist.create({ data: { name: 'Miles Davis', sortName: 'Davis, Miles' } });
  const callerCaller = await prisma.artist.create({ data: { name: 'Some Caller' } });

  const kindOfBlue = await prisma.album.create({
    data: { collectionId: vinyl.id, title: 'Kind of Blue', format: 'LP', year: 1959, genre: 'Jazz' },
  });
  await prisma.album_artist.create({ data: { albumId: kindOfBlue.id, artistId: milesDavis.id } });

  // Same title, two copies in two locations — the case duplicate-check (#13) covers.
  await prisma.copy.create({
    data: { albumId: kindOfBlue.id, locationId: shelf3.id, sourceId: recordStore.id, price: 24.99, condition: 'VG+' },
  });
  await prisma.copy.create({
    data: { albumId: kindOfBlue.id, locationId: alexRoom.id, condition: 'VG' },
  });

  const plusCalls = await prisma.album.create({
    data: { collectionId: calls.id, title: 'Plus Program Calls', format: 'mp3' },
  });
  await prisma.album_artist.create({ data: { albumId: plusCalls.id, artistId: callerCaller.id } });
  await prisma.copy.create({ data: { albumId: plusCalls.id, locationId: icloud.id } });

  await prisma.want_item.create({
    data: { collectionId: vinyl.id, artistId: milesDavis.id, priority: 'nice-to-have', notes: 'anything else by him' },
  });

  console.log('seed: done — 2 users, 2 collections, 2 artists, 2 albums, 3 copies, 1 want item');
}

main()
  .catch((e) => {
    console.error('seed: FAILED', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
