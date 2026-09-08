import { prisma } from '../database.js';

// Descendant lookup for rolling up copies from child locations (#5). Nesting
// is a simple parent/child structure (e.g. Room -> Shelf), not a deep
// arbitrary tree, so a plain BFS over parentLocationId is enough — no need
// for a recursive CTE.
const collectDescendantLocationIds = async (rootId: string): Promise<string[]> => {
  const ids = [rootId];
  let frontier = [rootId];
  while (frontier.length) {
    const children = await prisma.location.findMany({
      where: { parentLocationId: { in: frontier } },
      select: { id: true },
    });
    if (!children.length) break;
    const childIds = children.map((c) => c.id);
    ids.push(...childIds);
    frontier = childIds;
  }
  return ids;
};

// accessibleCollectionIds: undefined = no restriction (admin caller);
// otherwise results are confined to this set, intersected with an explicit
// collectionId filter if the caller also supplied one. A location belongs to
// exactly one collection (#53), so this is the same scoping album/copy/
// want_item already use.
export const listLocationsService = async (
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
  return prisma.location.findMany({
    where: { ...(scopedCollectionIds ? { collectionId: { in: scopedCollectionIds } } : {}) },
    include: { parent: true },
    orderBy: { name: 'asc' },
  });
};

export const getLocationService = async (id: string) => {
  const location = await prisma.location.findUnique({ where: { id }, include: { parent: true } });
  if (!location) return null;
  const descendantIds = await collectDescendantLocationIds(id);
  const copies = await prisma.copy.findMany({
    where: { locationId: { in: descendantIds } },
    include: { album: true, source: true },
  });
  return { ...location, copies };
};

export const createLocationService = async (data: {
  name: string;
  kind: string;
  collectionId: string;
  parentLocationId?: string;
  notes?: string;
}) => {
  return prisma.location.create({ data, include: { parent: true } });
};

export const updateLocationService = async (
  id: string,
  data: { name?: string; kind?: string; parentLocationId?: string; notes?: string },
) => {
  return prisma.location.update({ where: { id }, data, include: { parent: true } });
};

export const deleteLocationService = async (id: string) => {
  return prisma.location.delete({ where: { id } });
};
