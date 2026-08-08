import type { NextFunction, Request, Response } from 'express';
import { ValidationError, ConflictError, NotFoundError } from '../common/errorHandler.js';
import { routeParam } from '../common/utils.js';
import {
  listLocationsService,
  getLocationService,
  createLocationService,
  updateLocationService,
  deleteLocationService,
} from '../service/location.js';

const isPrismaError = (error: unknown, code: string): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === code;

export const listLocations = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const records = await listLocationsService();
    res.json({ message: 'List of locations', data: records, status: 200 });
  } catch (error) {
    next(error);
  }
};

export const getLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = routeParam(req.params.id);
    const record = await getLocationService(id);
    if (!record) throw new NotFoundError(`Location id:${id} not found.`);
    res.json({ message: 'Location by id, with rolled-up copies', data: record, status: 200 });
  } catch (error) {
    next(error);
  }
};

export const createLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, kind, parentLocationId, ownerId, notes } = req.body;
    if (!name) throw new ValidationError('name is required.');
    if (!kind) throw new ValidationError('kind is required.');
    const record = await createLocationService({ name, kind, parentLocationId, ownerId, notes });
    res.status(201).json({ message: 'Location created', data: record, status: 201 });
  } catch (error) {
    if (isPrismaError(error, 'P2003')) return next(new ConflictError('parentLocationId or ownerId does not exist.'));
    next(error);
  }
};

export const updateLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = routeParam(req.params.id);
    const existing = await getLocationService(id);
    if (!existing) throw new NotFoundError(`Location id:${id} not found.`);
    const { name, kind, parentLocationId, ownerId, notes } = req.body;
    const record = await updateLocationService(id, { name, kind, parentLocationId, ownerId, notes });
    res.json({ message: 'Location updated', data: record, status: 200 });
  } catch (error) {
    if (isPrismaError(error, 'P2003')) return next(new ConflictError('parentLocationId or ownerId does not exist.'));
    next(error);
  }
};

export const deleteLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = routeParam(req.params.id);
    const existing = await getLocationService(id);
    if (!existing) throw new NotFoundError(`Location id:${id} not found.`);
    await deleteLocationService(id);
    res.json({ message: 'Location deleted', data: null, status: 200 });
  } catch (error) {
    if (isPrismaError(error, 'P2003')) return next(new ConflictError('location is still referenced by a copy or child location.'));
    next(error);
  }
};
