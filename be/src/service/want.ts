import { prisma } from '../database.js';

// accessibleCollectionIds: undefined = no restriction (admin caller);
// otherwise scoped to this set, intersected with an explicit collectionId
// filter if the caller also supplied one.
export const listWantItemsService = async (
  filters: { collectionId?: string },
  accessibleCollectionIds: string[] | undefined,
) => {
  const { collectionId } = filters;
  const scopedCollectionIds = accessibleCollectionIds
    ? collectionId
      ? accessibleCollectionIds.filter((id) => id === collectionId)
      : accessibleCollectionIds
    : collectionId
      ? [collectionId]
      : undefined;
  return prisma.want_item.findMany({
    where: { ...(scopedCollectionIds ? { collectionId: { in: scopedCollectionIds } } : {}) },
    include: { artist: true, album: true },
    orderBy: { priority: 'asc' },
  });
};

export const getWantItemService = async (id: string) => {
  return prisma.want_item.findUnique({ where: { id }, include: { artist: true, album: true } });
};

export const createWantItemService = async (data: {
  collectionId: string;
  artistId?: string;
  albumId?: string;
  priority: string;
  notes?: string;
}) => {
  return prisma.want_item.create({ data, include: { artist: true, album: true } });
};

export const updateWantItemService = async (
  id: string,
  data: { priority?: string; notes?: string },
) => {
  return prisma.want_item.update({ where: { id }, data, include: { artist: true, album: true } });
};

export const deleteWantItemService = async (id: string) => {
  return prisma.want_item.delete({ where: { id } });
};

// Converts a want item into a real copy (and, for an artist-level want, an
// album + album_artist credit if one wasn't picked/created already), then
// removes the want item — one atomic flow instead of delete-then-recreate.
export const markWantItemFoundService = async (
  id: string,
  data: {
    locationId: string;
    sourceId?: string;
    dateAcquired?: string;
    price?: number;
    condition?: string;
    notes?: string;
    albumId?: string;
    album?: {
      title: string;
      format?: string;
      year?: number;
      genre?: string;
      notes?: string;
      coverImageUrl?: string;
    };
  },
) => {
  const want = await prisma.want_item.findUniqueOrThrow({ where: { id } });
  const { locationId, sourceId, dateAcquired, price, condition, notes, albumId, album } = data;

  return prisma.$transaction(async (tx) => {
    let resolvedAlbumId = want.albumId;

    if (!resolvedAlbumId) {
      if (albumId) {
        resolvedAlbumId = albumId;
      } else if (album) {
        const created = await tx.album.create({
          data: { collectionId: want.collectionId, ...album },
        });
        resolvedAlbumId = created.id;
      }
      if (want.artistId && resolvedAlbumId) {
        await tx.album_artist.upsert({
          where: { albumId_artistId: { albumId: resolvedAlbumId, artistId: want.artistId } },
          create: { albumId: resolvedAlbumId, artistId: want.artistId },
          update: {},
        });
      }
    }

    const copy = await tx.copy.create({
      data: { albumId: resolvedAlbumId as string, locationId, sourceId, dateAcquired, price, condition, notes },
      include: { location: true, source: true },
    });
    const resultAlbum = await tx.album.findUniqueOrThrow({ where: { id: resolvedAlbumId as string } });
    await tx.want_item.delete({ where: { id } });

    return { copy, album: resultAlbum };
  });
};
