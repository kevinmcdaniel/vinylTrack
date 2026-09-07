import { prisma } from '../database.js';
import { ValidationError } from '../common/errorHandler.js';
import { assertLocationInCollection } from './copy.js';
import { ownerForUserService } from './owner.js';

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
//
// callerUserId is who is standing in the record store: with no explicit
// ownerId, the copy is attributed to that person's own owner row (#53), which
// is the overwhelmingly common case — you buy your own records.
export const markWantItemFoundService = async (
  id: string,
  callerUserId: string,
  data: {
    locationId: string;
    ownerId?: string;
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
  const { locationId, ownerId, sourceId, dateAcquired, price, condition, notes, albumId, album } = data;

  await assertLocationInCollection(locationId, want.collectionId);

  const resolvedOwnerId = ownerId ?? (await ownerForUserService(callerUserId))?.id;
  if (!resolvedOwnerId) {
    throw new ValidationError('ownerId is required — the caller has no owner of their own.');
  }

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
      data: {
        albumId: resolvedAlbumId as string,
        locationId,
        ownerId: resolvedOwnerId,
        sourceId,
        dateAcquired,
        price,
        condition,
        notes,
      },
      include: { location: true, owner: { select: { id: true, name: true } }, source: true },
    });
    const resultAlbum = await tx.album.findUniqueOrThrow({ where: { id: resolvedAlbumId as string } });
    await tx.want_item.delete({ where: { id } });

    return { copy, album: resultAlbum };
  });
};
