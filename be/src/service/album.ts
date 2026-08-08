import { prisma } from '../database.js';

const withArtists = { artists: { include: { artist: true } } } as const;

const flattenArtists = <T extends { artists: { artist: unknown }[] }>(album: T) => {
  const { artists, ...rest } = album;
  return { ...rest, artists: artists.map((a) => a.artist) };
};

// accessibleCollectionIds: undefined = no restriction (admin caller);
// otherwise results are always confined to this set, intersected with an
// explicit collectionId filter if the caller also supplied one.
export const listAlbumsService = async (
  filters: { collectionId?: string; artistId?: string; format?: string; genre?: string },
  accessibleCollectionIds: string[] | undefined,
) => {
  const { collectionId, artistId, format, genre } = filters;
  const scopedCollectionIds = accessibleCollectionIds
    ? collectionId
      ? accessibleCollectionIds.filter((id) => id === collectionId)
      : accessibleCollectionIds
    : collectionId
      ? [collectionId]
      : undefined;
  const albums = await prisma.album.findMany({
    where: {
      ...(scopedCollectionIds ? { collectionId: { in: scopedCollectionIds } } : {}),
      ...(format ? { format } : {}),
      ...(genre ? { genre } : {}),
      ...(artistId ? { artists: { some: { artistId } } } : {}),
    },
    include: withArtists,
    orderBy: { title: 'asc' },
  });
  return albums.map(flattenArtists);
};

export const getAlbumService = async (id: string) => {
  const album = await prisma.album.findUnique({
    where: { id },
    include: { ...withArtists, copies: { include: { location: { include: { parent: true } }, source: true } } },
  });
  if (!album) return null;
  return flattenArtists(album);
};

export const createAlbumService = async (data: {
  collectionId: string;
  title: string;
  format?: string;
  year?: number;
  genre?: string;
  notes?: string;
  coverImageUrl?: string;
  artistIds?: string[];
}) => {
  const { artistIds, ...albumData } = data;
  const album = await prisma.album.create({
    data: {
      ...albumData,
      ...(artistIds ? { artists: { create: artistIds.map((artistId) => ({ artistId })) } } : {}),
    },
    include: withArtists,
  });
  return flattenArtists(album);
};

export const updateAlbumService = async (
  id: string,
  data: {
    title?: string;
    format?: string;
    year?: number;
    genre?: string;
    notes?: string;
    coverImageUrl?: string;
    artistIds?: string[];
  },
) => {
  const { artistIds, ...albumData } = data;
  const album = await prisma.$transaction(async (tx) => {
    if (artistIds) {
      await tx.album_artist.deleteMany({ where: { albumId: id } });
      await tx.album_artist.createMany({ data: artistIds.map((artistId) => ({ albumId: id, artistId })) });
    }
    return tx.album.update({ where: { id }, data: albumData, include: withArtists });
  });
  return flattenArtists(album);
};

export const deleteAlbumService = async (id: string) => {
  return prisma.album.delete({ where: { id } });
};
