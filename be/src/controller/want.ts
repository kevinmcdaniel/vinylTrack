import type { NextFunction, Request, Response } from 'express';
import { ValidationError, ConflictError, NotFoundError } from '../common/errorHandler.js';
import { routeParam } from '../common/utils.js';
import {
  listWantItemsService,
  getWantItemService,
  createWantItemService,
  updateWantItemService,
  deleteWantItemService,
  markWantItemFoundService,
} from '../service/want.js';

const isPrismaError = (error: unknown, code: string): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === code;

export const listWantItems = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { collectionId } = req.query as Record<string, string>;
    const records = await listWantItemsService({ collectionId });
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
    const { locationId, sourceId, dateAcquired, price, condition, notes, albumId, album } = req.body;
    if (!locationId) throw new ValidationError('locationId is required.');
    if (!existing.albumId && !albumId && !album) {
      throw new ValidationError('an artist-level want needs albumId or album to mark as found.');
    }
    const record = await markWantItemFoundService(id, {
      locationId,
      sourceId,
      dateAcquired,
      price,
      condition,
      notes,
      albumId,
      album,
    });
    res.status(201).json({ message: 'Want item marked as found', data: record, status: 201 });
  } catch (error) {
    if (isPrismaError(error, 'P2003')) return next(new ConflictError('locationId, sourceId, or albumId does not exist.'));
    next(error);
  }
};
