// Access policy for collection-scoped resources (album, copy, want_item) and
// for owner-scoped resources (location). Central place to see what each
// resource/action requires — see be/src/route/*.ts for how each route wires
// these in, and issue #26 for the plan this implements.
//
//   resource     | read (list/:id)          | create                    | update/delete
//   -------------|---------------------------|---------------------------|---------------------------
//   artist       | requireActiveUser         | requireActiveUser         | requireAdmin (delete only)
//   album/copy/  | requireActiveUser +       | requireActiveUser +       | requireActiveUser +
//   want_item    | scoped to accessible      | requireCollectionAccess-  | requireCollectionAccess
//                | collections (list), or    | ForCreate                 | (404 if not accessible)
//                | 404 if :id not accessible |                           |
//   location     | requireActiveUser         | requireActiveUser         | requireActiveUser +
//                |                           |                           | requireLocationWriteAccess

import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../database.js';
import { ForbiddenError, NotFoundError } from './errorHandler.js';
import { routeParam } from './utils.js';

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

// location has no collectionId (#2) — write access follows ownerId directly.
// A location with no owner is treated as shared/communal for v1.
export const requireLocationWriteAccess = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    if (req.user?.isAdmin) return next();
    const id = routeParam(req.params.id);
    const location = id ? await prisma.location.findUnique({ where: { id }, select: { ownerId: true } }) : null;
    if (!location) return next(new NotFoundError('Location not found.'));
    if (location.ownerId && location.ownerId !== req.user?.id) {
      return next(new ForbiddenError('Only the owner or an admin can modify this location.'));
    }
    next();
  } catch (error) {
    next(error);
  }
};
