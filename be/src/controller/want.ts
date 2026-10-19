import type { NextFunction, Request, Response } from 'express';
import { ValidationError, ConflictError, NotFoundError } from '../common/errorHandler.js';
import { routeParam } from '../common/utils.js';
import { parseDate, parsePrice, parseYear } from '../common/fields.js';
import { accessibleCollectionIds } from '../common/policy.js';
import {
  listWantItemsService,
  getWantItemService,
  createWantItemService,
  updateWantItemService,
  deleteWantItemService,
  markWantItemFoundService,
} from '../service/want.js';

// The want list groups by exactly these two (#8); any other value would fall
// out of both groups, so it is refused rather than stored.
const PRIORITIES = ['must-have', 'nice-to-have'];
const assertPriority = (priority: unknown) => {
  if (!PRIORITIES.includes(priority as string)) {
    throw new ValidationError(`priority must be one of: ${PRIORITIES.join(', ')}.`);
  }
};

const isPrismaError = (error: unknown, code: string): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === code;

export const listWantItems = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { collectionId, includeMatches } = req.query as Record<string, string>;
    const scope = req.user!.isAdmin ? undefined : await accessibleCollectionIds(req.user!.id);
    // Same rule as includeCopies: anything but an explicit `true` is the cheap default.
    const records = await listWantItemsService({ collectionId, includeMatches: includeMatches === 'true' }, scope);
    res.json({ message: 'List of want items', data: records, status: 200 });
  } catch (error) {
    next(error);
  }
};

export const createWantItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { collectionId, artistId, albumId, priority, notes } = req.body;
    if (!collectionId) throw new ValidationError('collectionId is required.');
    if (!priority) throw new ValidationError('priority is required.');
    assertPriority(priority);
    if (!artistId && !albumId) throw new ValidationError('exactly one of artistId or albumId is required.');
    if (artistId && albumId) throw new ValidationError('only one of artistId or albumId may be set, not both.');
    const record = await createWantItemService({ collectionId, artistId, albumId, priority, notes });
    res.status(201).json({ message: 'Want item created', data: record, status: 201 });
  } catch (error) {
    if (isPrismaError(error, 'P2003')) return next(new ConflictError('collectionId, artistId, or albumId does not exist.'));
    next(error);
  }
};

export const updateWantItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = routeParam(req.params.id);
    const existing = await getWantItemService(id);
    if (!existing) throw new NotFoundError(`Want item id:${id} not found.`);
    const { priority, notes } = req.body;
    if (priority !== undefined) assertPriority(priority);
    const record = await updateWantItemService(id, { priority, notes });
    res.json({ message: 'Want item updated', data: record, status: 200 });
  } catch (error) {
    next(error);
  }
};

export const deleteWantItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = routeParam(req.params.id);
    const existing = await getWantItemService(id);
    if (!existing) throw new NotFoundError(`Want item id:${id} not found.`);
    await deleteWantItemService(id);
    res.json({ message: 'Want item deleted', data: null, status: 200 });
  } catch (error) {
    next(error);
  }
};

export const markWantItemFound = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = routeParam(req.params.id);
    const existing = await getWantItemService(id);
    if (!existing) throw new NotFoundError(`Want item id:${id} not found.`);
    const { locationId, ownerId, sourceId, dateAcquired, price, condition, notes, albumId, album } = req.body;
    if (!locationId) throw new ValidationError('locationId is required.');
    if (!existing.albumId && !albumId && !album) {
      throw new ValidationError('an artist-level want needs albumId or album to mark as found.');
    }
    const record = await markWantItemFoundService(id, req.user!.id, {
      locationId,
      ownerId,
      sourceId,
      dateAcquired: parseDate(dateAcquired, 'dateAcquired'),
      price: parsePrice(price),
      condition,
      notes,
      albumId,
      album: album && typeof album === 'object' ? { ...album, year: parseYear(album.year) } : album,
    });
    res.status(201).json({ message: 'Want item marked as found', data: record, status: 201 });
  } catch (error) {
    if (isPrismaError(error, 'P2003')) {
      return next(new ConflictError('locationId, ownerId, sourceId, or albumId does not exist.'));
    }
    next(error);
  }
};
