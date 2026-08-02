import { prisma } from '../database.js';

const withRelations = { location: { include: { parent: true } }, source: true } as const;

export const listCopiesService = async (filters: { albumId?: string; locationId?: string }) => {
  const { albumId, locationId } = filters;
  return prisma.copy.findMany({
    where: {
      ...(albumId ? { albumId } : {}),
      ...(locationId ? { locationId } : {}),
    },
    include: withRelations,
  });
};

export const getCopyService = async (id: string) => {
  return prisma.copy.findUnique({ where: { id }, include: withRelations });
};

export const createCopyService = async (data: {
  albumId: string;
  locationId: string;
  sourceId?: string;
  dateAcquired?: string;
  price?: number;
  condition?: string;
  notes?: string;
}) => {
  return prisma.copy.create({ data, include: withRelations });
};

export const updateCopyService = async (
  id: string,
  data: {
    locationId?: string;
    sourceId?: string;
    dateAcquired?: string;
    price?: number;
    condition?: string;
    notes?: string;
  },
) => {
  return prisma.copy.update({ where: { id }, data, include: withRelations });
};

export const deleteCopyService = async (id: string) => {
  return prisma.copy.delete({ where: { id } });
};
