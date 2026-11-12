// Access policy for collection-scoped resources (album, copy, location,
// want_item) and for the global ones (artist, owner). Central place to see what
// each resource/action requires — see be/src/route/*.ts for how each route
// wires these in, and issue #26 for the plan this implements.
//
//   resource     | read (list/:id)          | create                    | update/delete
//   -------------|---------------------------|---------------------------|---------------------------
//   collection   | requireActiveUser +       | requireActiveUser (any    | requireCollectionOwner:
//                | scoped to accessible      | active user owns what     | rename + shares (#125);
//                | collections (list), or    | they start, #73)          | member 403, else 404.
//                | 404 if :id not accessible |                           | delete not built (#26)
//   artist/owner | requireActiveUser         | requireActiveUser         | requireAdmin (delete only)
//                | (row is global; artist's  |                           |
//                | linked albums are scoped) |                           |
//   album/copy/  | requireActiveUser +       | requireActiveUser +       | requireActiveUser +
//   location/    | scoped to accessible      | requireCollectionAccess-  | requireCollectionAccess
//   want_item    | collections (list), or    | ForCreate                 | (404 if not accessible)
//                | 404 if :id not accessible |                           |
//   user/admin   | requireAdmin (whole       | (sign-in only, #73)       | requireAdmin (approve/
//                | router: /api/user,        |                           | deny; not your own row)
//                | /api/admin/*, #90)        |                           |
//
// owner.userId is the exception on owner create/update: sending it at all is
// admin-only (403, #102 task 0), since linking an owner to an account is the
// admin's call on /admin/requests. Renaming stays open.
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

// Resolver for create routes whose body names the collection directly. A blank
// value ("" from an empty <select>, or null) means "not given", so it becomes
// `undefined` and reaches the controller's 406; `null` stays reserved for a
// lookup that found nothing.
export const collectionIdInBody = (req: Request): string | undefined =>
  (req.body.collectionId as string | null | undefined) || undefined;

// For POST (create) routes — the caller supplied the collectionId themselves,
// so a 403 (not a 404) is the honest answer when they don't belong to it.
// A missing collectionId (resolver returns `undefined`: nothing to look up) is
// left to the controller's own 406 validation. A resolver that looked a row up
// and found nothing returns `null`, which fails closed with the same 403 as an
// inaccessible collection — otherwise "doesn't exist" and "not yours" give
// different answers (#45).
export const requireCollectionAccessForCreate = (
  resolveCollectionId: (req: Request) => string | null | undefined | Promise<string | null | undefined>,
) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (req.user?.isAdmin) return next();
      const collectionId = await resolveCollectionId(req);
      if (collectionId === undefined) return next();
      if (!collectionId || !req.user || !(await isAccessibleCollection(req.user.id, collectionId))) {
        return next(new ForbiddenError('You do not have access to this collection.'));
      }
      next();
    } catch (error) {
      next(error);
    }
  };

// Collection settings (#125): rename and shares are the owner's (or an
// admin's). A shared member can already see the collection, so a 403 tells
// them nothing new; anyone else gets the usual 404, existence masked.
export const requireCollectionOwner = (resolveCollectionId: (req: Request) => Promise<string | null>) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const collectionId = await resolveCollectionId(req);
      const collection = collectionId && req.user
        ? await prisma.collection.findUnique({
          where: { id: collectionId },
          select: { ownerId: true, shares: { where: { userId: req.user.id }, select: { userId: true } } },
        })
        : null;
      // Looked up before the admin pass, so a missing id is a 404 for everyone
      // rather than reaching Prisma's update as a 500 (PR #138 review).
      if (!collection) return next(new NotFoundError('Resource not found.'));
      if (req.user!.isAdmin || collection.ownerId === req.user!.id) return next();
      if (collection.shares.length > 0) return next(new ForbiddenError('Only the collection\u2019s owner can change its settings.'));
      next(new NotFoundError('Resource not found.'));
    } catch (error) {
      next(error);
    }
  };
