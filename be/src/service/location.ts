import { prisma } from '../database.js';
import { ValidationError } from '../common/errorHandler.js';

// Descendant lookup for rolling up copies from child locations (#5). Nesting
// is a simple parent/child structure (e.g. Room -> Shelf), not a deep
// arbitrary tree, so a plain BFS over parentLocationId is enough — no need
// for a recursive CTE.
// `seen` stops the walk even if a loop already exists in the data: before #102
// nothing refused one, and a loop here used to spin a request forever.
const collectDescendantLocationIds = async (rootId: string): Promise<string[]> => {
  const seen = new Set([rootId]);
  let frontier = [rootId];
  while (frontier.length) {
    const children = await prisma.location.findMany({
      where: { parentLocationId: { in: frontier } },
      select: { id: true },
    });
    frontier = children.map((c) => c.id).filter((id) => !seen.has(id));
    for (const id of frontier) seen.add(id);
  }
  return [...seen];
};

// A parent must sit in the same collection (#53: copies never straddle one,
// and `parent` would leak another collection's location name) and must not
// be the location itself or anything inside it, or the chain loops (#102).
// A nonexistent parent is left to the FK, which the controller maps to 409.
export const assertValidParent = async (
  parentLocationId: string | null | undefined,
  collectionId: string,
  selfId?: string,
) => {
  if (!parentLocationId) return;
  const parent = await prisma.location.findUnique({
    where: { id: parentLocationId },
    select: { collectionId: true },
  });
  if (!parent) return;
  if (parent.collectionId !== collectionId) {
    throw new ValidationError('parentLocationId must be a location in the same collection.');
  }
  if (!selfId) return;
  // Walk up from the proposed parent; meeting selfId means a loop.
  const seen = new Set<string>();
  let current: string | null = parentLocationId;
  while (current && !seen.has(current)) {
    if (current === selfId) throw new ValidationError('A location cannot sit inside itself or one of its own locations.');
    seen.add(current);
    const row: { parentLocationId: string | null } | null = await prisma.location.findUnique({
      where: { id: current },
      select: { parentLocationId: true },
    });
    current = row?.parentLocationId ?? null;
  }
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
  data: { name?: string; kind?: string; parentLocationId?: string | null; notes?: string },
) => {
  return prisma.location.update({ where: { id }, data, include: { parent: true } });
};

export const deleteLocationService = async (id: string) => {
  return prisma.location.delete({ where: { id } });
};
