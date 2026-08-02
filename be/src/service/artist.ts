import { prisma } from '../database.js';

export const listArtistsService = async () => {
  return prisma.artist.findMany({ orderBy: { name: 'asc' } });
};

export const getArtistService = async (id: string) => {
  const artist = await prisma.artist.findUnique({
    where: { id },
    include: { albums: { include: { album: true } } },
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
