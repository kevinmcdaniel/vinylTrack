import { prisma } from '../database.js';
import { ValidationError } from '../common/errorHandler.js';
import { createAlbumWith, type NewAlbum } from './album.js';

// The copy's own owner (#53), not the location's: a record lent out keeps its
// attribution when it moves. Selected down to id+name so no `user` row — and
// no email — can ride along.
const withRelations = {
  location: { include: { parent: true } },
  owner: { select: { id: true, name: true } },
  source: true,
} as const;

// The list also names each copy's album (#126): what a location page shows.
const withAlbum = {
  ...withRelations,
  album: { select: { id: true, title: true, format: true, artists: { select: { artist: { select: { id: true, name: true } } } } } },
} as const;

// A location and every location inside it, top down, each level by name (#126).
// `seen` stops at a loop already in the data rather than spinning.
const locationTree = async (rootId: string) => {
  const order = [rootId];
  const seen = new Set(order);
  let frontier = order;
  while (frontier.length) {
    const children = await prisma.location.findMany({
      where: { parentLocationId: { in: frontier } },
      select: { id: true },
      orderBy: { name: 'asc' },
    });
    frontier = children.map((c) => c.id).filter((id) => !seen.has(id));
    for (const id of frontier) { seen.add(id); order.push(id); }
  }
  return order;
};

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

// The want list's albums obey the same chain (#129 item 1): a want, and the
// copy found-it makes from it, may only name an album in the want's own
// collection. Missing and elsewhere read the same (#45).
export const assertAlbumInCollection = async (albumId: string, collectionId: string, message: string) => {
  const album = await prisma.album.findUnique({ where: { id: albumId }, select: { collectionId: true } });
  if (album?.collectionId !== collectionId) throw new ValidationError(message);
};

// accessibleCollectionIds: undefined = no restriction (admin caller);
// otherwise results are confined to copies whose album belongs to one of
// these collections. Copies have no collectionId of their own — scoping
// goes through the album relation.
export const listCopiesService = async (
  filters: { albumId?: string; locationId?: string; includeSublocations?: boolean },
  accessibleCollectionIds: string[] | undefined,
) => {
  const { albumId, locationId, includeSublocations } = filters;
  const locationIds = locationId && includeSublocations ? await locationTree(locationId) : undefined;
  const copies = await prisma.copy.findMany({
    where: {
      ...(albumId ? { albumId } : {}),
      ...(locationIds ? { locationId: { in: locationIds } } : locationId ? { locationId } : {}),
      ...(accessibleCollectionIds ? { album: { collectionId: { in: accessibleCollectionIds } } } : {}),
    },
    include: withAlbum,
  });
  const rank = new Map((locationIds ?? []).map((id, i) => [id, i]));
  return copies
    .map(({ album, ...copy }) => ({ ...copy, album: { ...album, artists: album.artists.map((a) => a.artist) } }))
    // Shallowest location first, then by album title, so a shelf reads top down.
    .sort((a, b) => (rank.get(a.locationId) ?? 0) - (rank.get(b.locationId) ?? 0) || a.album.title.localeCompare(b.album.title));
};

export const getCopyService = async (id: string) => {
  return prisma.copy.findUnique({ where: { id }, include: withRelations });
};

type NewCopy = {
  locationId: string;
  ownerId: string;
  sourceId?: string;
  dateAcquired?: Date | null;
  price?: string | null;
  condition?: string;
  notes?: string;
};

// An existing album by id, or a new one (#123) created in the same
// transaction, so a refused copy never leaves an album behind.
export const createCopyService = async (data: NewCopy & ({ albumId: string } | { album: NewAlbum })) => {
  if ('album' in data) {
    const { album, ...copy } = data;
    await assertLocationInCollection(copy.locationId, album.collectionId);
    return prisma.$transaction(async (tx) => {
      const created = await createAlbumWith(tx, album);
      return tx.copy.create({ data: { ...copy, albumId: created.id }, include: withRelations });
    });
  }
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
    dateAcquired?: Date | null;
    price?: string | null;
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
