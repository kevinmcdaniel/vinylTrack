import type { NextFunction, Request, Response } from 'express';
import { ValidationError, ConflictError, NotFoundError } from '../common/errorHandler.js';
import { routeParam } from '../common/utils.js';
import {
  listOwnersService,
  getOwnerService,
  createOwnerService,
  updateOwnerService,
  deleteOwnerService,
  userHasOwner,
} from '../service/owner.js';

const isPrismaError = (error: unknown, code: string): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === code;

export const listOwners = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const records = await listOwnersService();
    res.json({ message: 'List of owners', data: records, status: 200 });
  } catch (error) {
    next(error);
  }
};

export const getOwner = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = routeParam(req.params.id);
    const record = await getOwnerService(id);
    if (!record) throw new NotFoundError(`Owner id:${id} not found.`);
    res.json({ message: 'Owner by id', data: record, status: 200 });
  } catch (error) {
    next(error);
  }
};

export const createOwner = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, userId } = req.body;
    if (!name) throw new ValidationError('name is required.');
    if (userId && (await userHasOwner(userId))) {
      throw new ConflictError('That user already has an owner.');
    }
    const record = await createOwnerService({ name, userId });
    res.status(201).json({ message: 'Owner created', data: record, status: 201 });
  } catch (error) {
    if (isPrismaError(error, 'P2003')) return next(new ConflictError('userId does not exist.'));
    next(error);
  }
};

export const updateOwner = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = routeParam(req.params.id);
    const existing = await getOwnerService(id);
    if (!existing) throw new NotFoundError(`Owner id:${id} not found.`);
    const { name, userId } = req.body;
    if (userId && (await userHasOwner(userId, id))) {
      throw new ConflictError('That user already has an owner.');
    }
    const record = await updateOwnerService(id, { name, userId });
    res.json({ message: 'Owner updated', data: record, status: 200 });
  } catch (error) {
    if (isPrismaError(error, 'P2003')) return next(new ConflictError('userId does not exist.'));
    next(error);
  }
};

export const deleteOwner = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = routeParam(req.params.id);
    const existing = await getOwnerService(id);
    if (!existing) throw new NotFoundError(`Owner id:${id} not found.`);
    await deleteOwnerService(id);
    res.json({ message: 'Owner deleted', data: null, status: 200 });
  } catch (error) {
    if (isPrismaError(error, 'P2003')) return next(new ConflictError('owner is still referenced by a copy.'));
    next(error);
  }
};
