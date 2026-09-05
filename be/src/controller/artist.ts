import type { NextFunction, Request, Response } from 'express';
import { ValidationError, NotFoundError } from '../common/errorHandler.js';
import { routeParam } from '../common/utils.js';
import { accessibleCollectionIds } from '../common/policy.js';
import {
  listArtistsService,
  getArtistService,
  createArtistService,
  updateArtistService,
  deleteArtistService,
} from '../service/artist.js';

export const listArtists = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const records = await listArtistsService();
    res.json({ message: 'List of all artists', data: records, status: 200 });
  } catch (error) {
    next(error);
  }
};

export const getArtist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = routeParam(req.params.id);
    const scope = req.user!.isAdmin ? undefined : await accessibleCollectionIds(req.user!.id);
    const record = await getArtistService(id, scope);
    if (!record) throw new NotFoundError(`Artist id:${id} not found.`);
    res.json({ message: 'Artist by id', data: record, status: 200 });
  } catch (error) {
    next(error);
  }
};

export const createArtist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, sortName, notes } = req.body;
    if (!name) throw new ValidationError('name is required.');
    const record = await createArtistService({ name, sortName, notes });
    res.status(201).json({ message: 'Artist created', data: record, status: 201 });
  } catch (error) {
    next(error);
  }
};

export const updateArtist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = routeParam(req.params.id);
    // Unscoped on purpose: existence check only. Artist rows are global, so a
    // caller who can see none of the artist's albums must still get 200, not 404.
    const existing = await getArtistService(id);
    if (!existing) throw new NotFoundError(`Artist id:${id} not found.`);
    const { name, sortName, notes } = req.body;
    const record = await updateArtistService(id, { name, sortName, notes });
    res.json({ message: 'Artist updated', data: record, status: 200 });
  } catch (error) {
    next(error);
  }
};

export const deleteArtist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = routeParam(req.params.id);
    const existing = await getArtistService(id);
    if (!existing) throw new NotFoundError(`Artist id:${id} not found.`);
    await deleteArtistService(id);
    res.json({ message: 'Artist deleted', data: null, status: 200 });
  } catch (error) {
    next(error);
  }
};
