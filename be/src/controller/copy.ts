import type { NextFunction, Request, Response } from 'express';
import { ValidationError, ConflictError, NotFoundError } from '../common/errorHandler.js';
import { routeParam } from '../common/utils.js';
import { accessibleCollectionIds } from '../common/policy.js';
import {
  listCopiesService,
  getCopyService,
  createCopyService,
  updateCopyService,
  deleteCopyService,
} from '../service/copy.js';

const isPrismaError = (error: unknown, code: string): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === code;

export const listCopies = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { albumId, locationId } = req.query as Record<string, string>;
    const scope = req.user!.isAdmin ? undefined : await accessibleCollectionIds(req.user!.id);
    const records = await listCopiesService({ albumId, locationId }, scope);
    res.json({ message: 'List of copies', data: records, status: 200 });
  } catch (error) {
    next(error);
  }
};

export const getCopy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = routeParam(req.params.id);
    const record = await getCopyService(id);
    if (!record) throw new NotFoundError(`Copy id:${id} not found.`);
    res.json({ message: 'Copy by id', data: record, status: 200 });
  } catch (error) {
    next(error);
  }
};

export const createCopy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { albumId, locationId, sourceId, dateAcquired, price, condition, notes } = req.body;
    if (!albumId) throw new ValidationError('albumId is required.');
    if (!locationId) throw new ValidationError('locationId is required.');
    const record = await createCopyService({ albumId, locationId, sourceId, dateAcquired, price, condition, notes });
    res.status(201).json({ message: 'Copy created', data: record, status: 201 });
  } catch (error) {
    if (isPrismaError(error, 'P2003')) return next(new ConflictError('albumId, locationId, or sourceId does not exist.'));
    next(error);
  }
};

export const updateCopy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = routeParam(req.params.id);
    const existing = await getCopyService(id);
    if (!existing) throw new NotFoundError(`Copy id:${id} not found.`);
    const { locationId, sourceId, dateAcquired, price, condition, notes } = req.body;
    const record = await updateCopyService(id, { locationId, sourceId, dateAcquired, price, condition, notes });
    res.json({ message: 'Copy updated', data: record, status: 200 });
  } catch (error) {
    if (isPrismaError(error, 'P2003')) return next(new ConflictError('locationId or sourceId does not exist.'));
    next(error);
  }
};

export const deleteCopy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = routeParam(req.params.id);
    const existing = await getCopyService(id);
    if (!existing) throw new NotFoundError(`Copy id:${id} not found.`);
    await deleteCopyService(id);
    res.json({ message: 'Copy deleted', data: null, status: 200 });
  } catch (error) {
    next(error);
  }
};
