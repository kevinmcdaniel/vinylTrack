// Dev seed data for issue #2 — two users, two collections (one owned, one shared),
// a couple of artists/albums, a duplicate copy across two locations (what #13's
// duplicate-check feature will look for), and a want-list item.
//
// Owners (#53) are seeded as their own rows: two linked to accounts and one —
// Grandma Ruth — with no `userId` at all, which is the case the whole owner
// table exists for. Every copy is owned here; `copy.ownerId` is nullable only
// because a non-null column cannot be added to a populated table in one step.
//
// Wipe-and-replace: safe to re-run against a populated dev DB.

import { prisma } from '../database.js';

async function main() {
  await prisma.want_item.deleteMany();
  await prisma.copy.deleteMany();
  await prisma.owner.deleteMany();
  await prisma.album_artist.deleteMany();
  await prisma.album.deleteMany();
  await prisma.source.deleteMany();
  await prisma.location.deleteMany();
  await prisma.collection_share.deleteMany();
  await prisma.collection.deleteMany();
  await prisma.artist.deleteMany();
  await prisma.user.deleteMany();

  // Owner, and deliberately NOT an admin: this is what most family members are,
  // so it's the identity that actually exercises the access rules in policy.ts
  // rather than the admin bypass. Also the AUTH_BOOTSTRAP_OWNER_EMAIL fallback.
  const kevin = await prisma.user.create({
    data: { email: 'kevin@example.com', name: 'Kevin', status: 'active' },
  });
  const alex = await prisma.user.create({
    data: { email: 'alex@example.com', name: 'Alex', status: 'active' },
  });
  // Active, but owns nothing and is shared nothing — the "outsider" identity the
  // Bruno collection (#34) needs to exercise the 403/404 access paths.
  await prisma.user.create({
    data: { email: 'jamie@example.com', name: 'Jamie', status: 'active' },
  });
  // Admin, owning nothing of their own — the bypass path in policy.ts, kept as a
  // separate identity so "owner" and "admin" can't be silently conflated (#34).
  await prisma.user.create({
    data: { email: 'admin@example.com', name: 'Admin', status: 'active', isAdmin: true },
  });

  // Whose records these are. Kevin and Alex have accounts; Ruth does not and
  // never will — she is why ownership is not a foreign key to `user` (#53).
  const kevinOwner = await prisma.owner.create({ data: { name: 'Kevin', userId: kevin.id } });
  const alexOwner = await prisma.owner.create({ data: { name: 'Alex', userId: alex.id } });
  const ruth = await prisma.owner.create({ data: { name: 'Grandma Ruth' } });

  const vinyl = await prisma.collection.create({
    data: { name: 'Squakville Vinyl', kind: 'physical', ownerId: kevin.id },
  });
  const calls = await prisma.collection.create({
    data: { name: 'Square Dance Music', kind: 'digital', ownerId: kevin.id },
  });
  await prisma.collection_share.create({
    data: { collectionId: vinyl.id, userId: alex.id, role: 'full' },
  });

  // Locations are children of a collection (#53) and carry no owner of their
  // own — `location.ownerId` is deprecated and deliberately left unset here.
  const basement = await prisma.location.create({
    data: { name: 'Basement', kind: 'physical', collectionId: vinyl.id },
  });
  const shelf3 = await prisma.location.create({
    data: { name: 'Shelf 3', kind: 'physical', collectionId: vinyl.id, parentLocationId: basement.id },
  });
  const alexRoom = await prisma.location.create({
    data: { name: "Alex's room", kind: 'physical', collectionId: vinyl.id },
  });
  const icloud = await prisma.location.create({
    data: { name: 'iCloud Drive/Music/SquareDance', kind: 'digital', collectionId: calls.id },
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

  // Same title, two copies in two locations, two different owners — the case
  // duplicate-check (#13) covers, now answering "whose" from the copy itself.
  await prisma.copy.create({
    data: {
      albumId: kindOfBlue.id,
      locationId: shelf3.id,
      ownerId: kevinOwner.id,
      sourceId: recordStore.id,
      price: 24.99,
      condition: 'VG+',
    },
  });
  await prisma.copy.create({
    data: { albumId: kindOfBlue.id, locationId: alexRoom.id, ownerId: alexOwner.id, condition: 'VG' },
  });

  const plusCalls = await prisma.album.create({
    data: { collectionId: calls.id, title: 'Plus Program Calls', format: 'mp3' },
  });
  await prisma.album_artist.create({ data: { albumId: plusCalls.id, artistId: callerCaller.id } });
  // Owned by the family member with no account — proves an owner needs no user.
  await prisma.copy.create({ data: { albumId: plusCalls.id, locationId: icloud.id, ownerId: ruth.id } });

  await prisma.want_item.create({
    data: { collectionId: vinyl.id, artistId: milesDavis.id, priority: 'nice-to-have', notes: 'anything else by him' },
  });

  console.log(
    'seed: done — 4 users, 3 owners, 2 collections, 4 locations, 2 artists, 2 albums, 3 copies, 1 want item',
  );
}

main()
  .catch((e) => {
    console.error('seed: FAILED', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
