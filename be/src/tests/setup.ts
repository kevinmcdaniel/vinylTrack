import 'dotenv/config';
import { prisma } from '../database.js';

// Test data uses this prefix to identify and clean up after tests
export const T = '_TEST_';

export async function cleanupTestData() {
  await prisma.want_item.deleteMany({ where: { artist: { name: { startsWith: T } } } });
  await prisma.want_item.deleteMany({ where: { album: { title: { startsWith: T } } } });
  await prisma.copy.deleteMany({
    where: {
      OR: [
        { album: { title: { startsWith: T } } },
        { location: { name: { startsWith: T } } },
        { source: { name: { startsWith: T } } },
      ],
    },
  });
  await prisma.album_artist.deleteMany({ where: { artist: { name: { startsWith: T } } } });
  await prisma.album.deleteMany({ where: { title: { startsWith: T } } });
  await prisma.artist.deleteMany({ where: { name: { startsWith: T } } });
  await prisma.collection_share.deleteMany({ where: { collection: { name: { startsWith: T } } } });
  await prisma.collection.deleteMany({ where: { name: { startsWith: T } } });
  await prisma.location.deleteMany({ where: { name: { startsWith: T } } });
  await prisma.source.deleteMany({ where: { name: { startsWith: T } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: T } } });
}

afterAll(async () => {
  await cleanupTestData();
  await prisma.$disconnect();
});
