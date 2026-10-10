import type { NextFunction, Request, Response } from 'express';
import { NotFoundError, ValidationError } from '../common/errorHandler.js';
import { assertOnlyFields, routeParam } from '../common/utils.js';
import { accessibleCollectionIds } from '../common/policy.js';
import { listCollectionsService, getCollectionService, createCollectionService } from '../service/collection.js';

const KINDS = ['physical', 'digital'] as const;

// Any active user may start a collection; they own it (#73). Sharing,
// renaming and deleting stay with #14.
export const createCollection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertOnlyFields(req.body, ['name', 'kind', 'notes'], (m) => new ValidationError(m));
    const { name, kind, notes } = req.body ?? {};
    if (typeof name !== 'string' || name.trim() === '') throw new ValidationError('name is required.');
    if (!KINDS.includes(kind)) throw new ValidationError(`kind must be one of ${KINDS.join(', ')}.`);
    if (notes !== undefined && notes !== null && typeof notes !== 'string') throw new ValidationError('notes must be a string.');
    const record = await createCollectionService({ name: name.trim(), kind, notes: notes ?? null }, req.user!.id);
    res.status(201).json({ message: 'Collection created', data: record, status: 201 });
  } catch (error) {
    next(error);
  }
};

export const listCollections = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scope = req.user!.isAdmin ? undefined : await accessibleCollectionIds(req.user!.id);
    const records = await listCollectionsService(scope);
    res.json({ message: 'List of collections', data: records, status: 200 });
  } catch (error) {
    next(error);
  }
};

export const getCollection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = routeParam(req.params.id);
    const record = await getCollectionService(id);
    if (!record) throw new NotFoundError(`Collection id:${id} not found.`);
    res.json({ message: 'Collection by id', data: record, status: 200 });
  } catch (error) {
    next(error);
  }
};
