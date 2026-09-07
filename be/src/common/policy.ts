// Access policy for collection-scoped resources (album, copy, location,
// want_item) and for the global ones (artist, owner). Central place to see what
// each resource/action requires — see be/src/route/*.ts for how each route
// wires these in, and issue #26 for the plan this implements.
//
//   resource     | read (list/:id)          | create                    | update/delete
//   -------------|---------------------------|---------------------------|---------------------------
//   collection   | requireActiveUser +       | (not built — #26)         | (not built — #26)
//                | scoped to accessible      |                           |
//                | collections (list), or    |                           |
//                | 404 if :id not accessible |                           |
//   artist/owner | requireActiveUser         | requireActiveUser         | requireAdmin (delete only)
//                | (row is global; artist's  |                           |
//                | linked albums are scoped) |                           |
//   album/copy/  | requireActiveUser +       | requireActiveUser +       | requireActiveUser +
//   location/    | scoped to accessible      | requireCollectionAccess-  | requireCollectionAccess
//   want_item    | collections (list), or    | ForCreate                 | (404 if not accessible)
//                | 404 if :id not accessible |                           |
//
// location joined that row in #53: it carries a collectionId now, so the old
// ownerId special case (and the unowned-is-communal rule with it) is gone.

import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../database.js';
import { ForbiddenError, NotFoundError } from './errorHandler.js';

export const accessibleCollectionIds = async (userId: string): Promise<string[]> => {
  const [owned, shared] = await Promise.all([
    prisma.collection.findMany({ where: { ownerId: userId }, select: { id: true } }),
    prisma.collection_share.findMany({ where: { userId }, select: { collectionId: true } }),
  ]);
  return [...new Set([...owned.map((c) => c.id), ...shared.map((s) => s.collectionId)])];
};

const isAccessibleCollection = async (userId: string, collectionId: string): Promise<boolean> => {
  const collection = await prisma.collection.findUnique({
    where: { id: collectionId },
    include: { shares: { where: { userId } } },
  });
  if (!collection) return false;
  return collection.ownerId === userId || collection.shares.length > 0;
};

// For GET/PATCH/DELETE :id routes on a collection-scoped resource — a
// resource in an inaccessible collection reads as 404, same as one that
// doesn't exist, rather than revealing it exists via a 403.
export const requireCollectionAccess = (resolveCollectionId: (req: Request) => Promise<string | null>) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (req.user?.isAdmin) return next();
      const collectionId = await resolveCollectionId(req);
      if (!collectionId || !req.user || !(await isAccessibleCollection(req.user.id, collectionId))) {
        return next(new NotFoundError('Resource not found.'));
      }
      next();
    } catch (error) {
      next(error);
    }
  };

// For POST (create) routes — the caller supplied the collectionId themselves,
// so a 403 (not a 404) is the honest answer when they don't belong to it.
// A missing collectionId is left to the controller's own 406 validation.
export const requireCollectionAccessForCreate = (
  resolveCollectionId: (req: Request) => string | undefined | Promise<string | undefined>,
) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (req.user?.isAdmin) return next();
      const collectionId = await resolveCollectionId(req);
      if (!collectionId) return next();
      if (!req.user || !(await isAccessibleCollection(req.user.id, collectionId))) {
        return next(new ForbiddenError('You do not have access to this collection.'));
      }
      next();
    } catch (error) {
      next(error);
    }
  };
