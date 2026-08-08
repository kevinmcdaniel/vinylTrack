import { prisma } from '../database.js';

const withArtists = { artists: { include: { artist: true } } } as const;

const flattenArtists = <T extends { artists: { artist: unknown }[] }>(album: T) => {
  const { artists, ...rest } = album;
  return { ...rest, artists: artists.map((a) => a.artist) };
};

export const listAlbumsService = async (filters: {
  collectionId?: string;
  artistId?: string;
  format?: string;
  genre?: string;
}) => {
  const { collectionId, artistId, format, genre } = filters;
  const albums = await prisma.album.findMany({
    where: {
      ...(collectionId ? { collectionId } : {}),
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
