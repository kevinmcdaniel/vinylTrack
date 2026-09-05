import { prisma } from '../database.js';

export const listArtistsService = async () => {
  return prisma.artist.findMany({ orderBy: { name: 'asc' } });
};

// The artist row itself is global and unscoped (see policy.ts) — any active
// user can read it. Its *linked albums* are not: an album belongs to exactly
// one collection, so the list is filtered to the caller's accessible
// collections (undefined = admin, unfiltered). Each album carries its
// collection so the UI can label which one a result came from (#7).
export const getArtistService = async (id: string, accessibleCollectionIds?: string[]) => {
  const artist = await prisma.artist.findUnique({
    where: { id },
    include: {
      albums: {
        where: accessibleCollectionIds
          ? { album: { collectionId: { in: accessibleCollectionIds } } }
          : {},
        include: { album: { include: { collection: { select: { id: true, name: true } } } } },
      },
    },
  });
  if (!artist) return null;
  const { albums, ...rest } = artist;
  return { ...rest, albums: albums.map((a) => a.album) };
};

export const createArtistService = async (data: { name: string; sortName?: string; notes?: string }) => {
  return prisma.artist.create({ data });
};

export const updateArtistService = async (
  id: string,
  data: { name?: string; sortName?: string; notes?: string },
) => {
  return prisma.artist.update({ where: { id }, data });
};

export const deleteArtistService = async (id: string) => {
  return prisma.artist.delete({ where: { id } });
};
