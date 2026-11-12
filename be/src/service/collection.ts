import { prisma } from '../database.js';
import { ConflictError, NotFoundError, ValidationError } from '../common/errorHandler.js';

// The owner rides along as { id, name } (#125): enough to say "Shared by" and
// to tell the owner from a member, never an email.
const withAlbumCount = { _count: { select: { albums: true } }, owner: { select: { id: true, name: true } } } as const;

const flattenCount = <T extends { _count: { albums: number } }>(collection: T) => {
  const { _count, ...rest } = collection;
  return { ...rest, albumCount: _count.albums };
};

// accessibleCollectionIds: undefined = no restriction (admin caller);
// otherwise results are confined to the collections the caller owns or has
// been shared. This is the switcher's data source (#7/#14), so it must never
// surface a collection the caller doesn't belong to.
export const listCollectionsService = async (accessibleCollectionIds: string[] | undefined) => {
  const collections = await prisma.collection.findMany({
    where: accessibleCollectionIds ? { id: { in: accessibleCollectionIds } } : {},
    include: withAlbumCount,
    orderBy: { name: 'asc' },
  });
  return collections.map(flattenCount);
};

export const createCollectionService = async (data: { name: string; kind: string; notes?: string | null }, ownerId: string) => {
  const collection = await prisma.collection.create({ data: { ...data, ownerId }, include: withAlbumCount });
  return flattenCount(collection);
};

export const getCollectionService = async (id: string) => {
  const collection = await prisma.collection.findUnique({ where: { id }, include: withAlbumCount });
  if (!collection) return null;
  return flattenCount(collection);
};

// Rename and re-note (#125). kind stays fixed: locations and copy fields depend on it.
export const updateCollectionService = async (id: string, data: { name?: string; notes?: string | null }) => {
  const collection = await prisma.collection.update({ where: { id }, data, include: withAlbumCount });
  return flattenCount(collection);
};

const personSelect = { id: true, name: true, email: true } as const;
const byPerson = [{ name: 'asc' as const }, { email: 'asc' as const }];

// Who a collection is shared with (#125), as the owner's settings page shows them.
export const listSharesService = async (collectionId: string) => {
  const shares = await prisma.collection_share.findMany({
    where: { collectionId },
    select: { user: { select: personSelect } },
    orderBy: { user: { name: 'asc' } },
  });
  return shares.map((s) => s.user);
};

// Who it could be shared with: active users, not the owner, not already in.
export const shareCandidatesService = async (collectionId: string) => {
  const collection = await prisma.collection.findUniqueOrThrow({ where: { id: collectionId }, select: { ownerId: true } });
  return prisma.user.findMany({
    where: { status: 'active', id: { not: collection.ownerId }, sharedCollections: { none: { collectionId } } },
    select: personSelect,
    orderBy: byPerson,
  });
};

export const addShareService = async (collectionId: string, userId: string) => {
  const [collection, user] = await Promise.all([
    prisma.collection.findUniqueOrThrow({ where: { id: collectionId }, select: { ownerId: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { status: true } }),
  ]);
  if (!user || user.status !== 'active') throw new ValidationError('userId must be an approved user.');
  if (userId === collection.ownerId) throw new ValidationError('The owner already has this collection.');
  try {
    await prisma.collection_share.create({ data: { collectionId, userId, role: 'full' } });
  } catch (error) {
    // The (collectionId, userId) key decides, so two racing requests get 201 and 409.
    if (typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002') {
      throw new ConflictError('Already shared with that user.');
    }
    throw error;
  }
  return listSharesService(collectionId);
};

export const removeShareService = async (collectionId: string, userId: string) => {
  const { count } = await prisma.collection_share.deleteMany({ where: { collectionId, userId } });
  if (count === 0) throw new NotFoundError('Not shared with that user.');
};
