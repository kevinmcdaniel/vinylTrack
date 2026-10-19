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
import { seedUsers } from './seedData.js';

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

  const kevin = await prisma.user.create({ data: seedUsers.kevin });
  const alex = await prisma.user.create({ data: seedUsers.alex });
  await prisma.user.create({ data: seedUsers.jamie });
  await prisma.user.create({ data: seedUsers.admin });

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
  // own; whose a record is lives on the copy.
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

  // Another pressing of the same record, owned by Ruth: the want list's
  // duplicate check (#8, #13) matches it by title (case aside) + shared artist.
  // Titled "Kind Of Blue" so lookups for the original by exact title stay unique.
  const kindOfBlueReissue = await prisma.album.create({
    data: { collectionId: vinyl.id, title: 'Kind Of Blue', format: 'LP', year: 1997, genre: 'Jazz' },
  });
  await prisma.album_artist.create({ data: { albumId: kindOfBlueReissue.id, artistId: milesDavis.id } });
  await prisma.copy.create({
    data: { albumId: kindOfBlueReissue.id, locationId: basement.id, ownerId: ruth.id, condition: 'NM' },
  });

  // Known to the catalog, owned by nobody: an album-level want with no match.
  const sketches = await prisma.album.create({
    data: { collectionId: vinyl.id, title: 'Sketches of Spain', format: 'LP', year: 1960, genre: 'Jazz' },
  });
  await prisma.album_artist.create({ data: { albumId: sketches.id, artistId: milesDavis.id } });
  const coltrane = await prisma.artist.create({ data: { name: 'John Coltrane', sortName: 'Coltrane, John' } });

  // One want per duplicate-check path: album hit, album miss, artist hit, artist miss.
  await prisma.want_item.create({
    data: { collectionId: vinyl.id, albumId: kindOfBlue.id, priority: 'must-have', notes: 'a mono pressing' },
  });
  await prisma.want_item.create({ data: { collectionId: vinyl.id, albumId: sketches.id, priority: 'must-have' } });
  await prisma.want_item.create({
    data: { collectionId: vinyl.id, artistId: milesDavis.id, priority: 'nice-to-have', notes: 'anything else by him' },
  });
  await prisma.want_item.create({ data: { collectionId: vinyl.id, artistId: coltrane.id, priority: 'nice-to-have' } });

  console.log(
    'seed: done — 4 users, 3 owners, 2 collections, 4 locations, 3 artists, 4 albums, 4 copies, 4 want items',
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
