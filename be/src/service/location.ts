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

export const listLocationsService = async () => {
  return prisma.location.findMany({
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
  parentLocationId?: string;
  ownerId?: string;
  notes?: string;
}) => {
  return prisma.location.create({ data, include: { parent: true } });
};

export const updateLocationService = async (
  id: string,
  data: { name?: string; kind?: string; parentLocationId?: string; ownerId?: string; notes?: string },
) => {
  return prisma.location.update({ where: { id }, data, include: { parent: true } });
};

export const deleteLocationService = async (id: string) => {
  return prisma.location.delete({ where: { id } });
};
