import 'dotenv/config';
import { prisma } from '../database.js';

// Test data uses this prefix to identify and clean up after tests
export const T = '_TEST_';

// Auth scaffolding (#26) resolves the caller from this header against the
// seeded user table. Tests impersonate a specific user by name; a missing
// header (no call) falls through to AUTH_BOOTSTRAP_OWNER_EMAIL, which is why
// tests that want to assert 401 must NOT set this header.
export const authHeader = (email: string) => ({ 'x-user-email': email });

export async function createTestAdmin(suffix = 'admin') {
  return prisma.user.create({ data: { email: `${T}${suffix}@example.com`, status: 'active', isAdmin: true } });
}

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
