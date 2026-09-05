import { prisma } from '../database.js';

const withAlbumCount = { _count: { select: { albums: true } } } as const;

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

export const getCollectionService = async (id: string) => {
  const collection = await prisma.collection.findUnique({ where: { id }, include: withAlbumCount });
  if (!collection) return null;
  return flattenCount(collection);
};
