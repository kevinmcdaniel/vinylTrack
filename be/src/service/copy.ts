import { prisma } from '../database.js';
import { ValidationError } from '../common/errorHandler.js';

// The copy's own owner (#53), not the location's: a record lent out keeps its
// attribution when it moves. Selected down to id+name so no `user` row — and
// no email — can ride along.
const withRelations = {
  location: { include: { parent: true } },
  owner: { select: { id: true, name: true } },
  source: true,
} as const;

// album + location + collection are one chain (#53): an album belongs to a
// collection and so does a location, so a copy may not straddle two of them.
export const assertLocationInCollection = async (locationId: string, collectionId: string) => {
  const location = await prisma.location.findUnique({
    where: { id: locationId },
    select: { collectionId: true },
  });
  // A missing location is left to the P2003 conflict path, not reported here.
  if (location && location.collectionId !== collectionId) {
    throw new ValidationError('locationId belongs to a different collection than the album.');
  }
};

// accessibleCollectionIds: undefined = no restriction (admin caller);
// otherwise results are confined to copies whose album belongs to one of
// these collections. Copies have no collectionId of their own — scoping
// goes through the album relation.
export const listCopiesService = async (
  filters: { albumId?: string; locationId?: string },
  accessibleCollectionIds: string[] | undefined,
) => {
  const { albumId, locationId } = filters;
  return prisma.copy.findMany({
    where: {
      ...(albumId ? { albumId } : {}),
      ...(locationId ? { locationId } : {}),
      ...(accessibleCollectionIds ? { album: { collectionId: { in: accessibleCollectionIds } } } : {}),
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
  ownerId: string;
  sourceId?: string;
  dateAcquired?: string;
  price?: number;
  condition?: string;
  notes?: string;
}) => {
  const album = await prisma.album.findUnique({
    where: { id: data.albumId },
    select: { collectionId: true },
  });
  if (album) await assertLocationInCollection(data.locationId, album.collectionId);
  return prisma.copy.create({ data, include: withRelations });
};

export const updateCopyService = async (
  id: string,
  data: {
    locationId?: string;
    ownerId?: string;
    sourceId?: string;
    dateAcquired?: string;
    price?: number;
    condition?: string;
    notes?: string;
  },
) => {
  if (data.locationId) {
    const copy = await prisma.copy.findUnique({
      where: { id },
      select: { album: { select: { collectionId: true } } },
    });
    if (copy) await assertLocationInCollection(data.locationId, copy.album.collectionId);
  }
  return prisma.copy.update({ where: { id }, data, include: withRelations });
};

export const deleteCopyService = async (id: string) => {
  return prisma.copy.delete({ where: { id } });
};
