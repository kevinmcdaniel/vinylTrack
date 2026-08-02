import type { NextFunction, Request, Response } from 'express';
import { ValidationError, ConflictError, NotFoundError } from '../common/errorHandler.js';
import { routeParam } from '../common/utils.js';
import { accessibleCollectionIds } from '../common/policy.js';
import {
  listAlbumsService,
  getAlbumService,
  createAlbumService,
  updateAlbumService,
  deleteAlbumService,
} from '../service/album.js';

const isPrismaError = (error: unknown, code: string): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === code;

export const listAlbums = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { collectionId, artistId, format, genre } = req.query as Record<string, string>;
    const scope = req.user!.isAdmin ? undefined : await accessibleCollectionIds(req.user!.id);
    const records = await listAlbumsService({ collectionId, artistId, format, genre }, scope);
    res.json({ message: 'List of albums', data: records, status: 200 });
  } catch (error) {
    next(error);
  }
};

export const getAlbum = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = routeParam(req.params.id);
    const record = await getAlbumService(id);
    if (!record) throw new NotFoundError(`Album id:${id} not found.`);
    res.json({ message: 'Album by id', data: record, status: 200 });
  } catch (error) {
    next(error);
  }
};

export const createAlbum = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { collectionId, title, format, year, genre, notes, coverImageUrl, artistIds } = req.body;
    if (!collectionId) throw new ValidationError('collectionId is required.');
    if (!title) throw new ValidationError('title is required.');
    const record = await createAlbumService({ collectionId, title, format, year, genre, notes, coverImageUrl, artistIds });
    res.status(201).json({ message: 'Album created', data: record, status: 201 });
  } catch (error) {
    if (isPrismaError(error, 'P2003')) return next(new ConflictError('collectionId or one of artistIds does not exist.'));
    next(error);
  }
};

export const updateAlbum = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = routeParam(req.params.id);
    const existing = await getAlbumService(id);
    if (!existing) throw new NotFoundError(`Album id:${id} not found.`);
    const { title, format, year, genre, notes, coverImageUrl, artistIds } = req.body;
    const record = await updateAlbumService(id, { title, format, year, genre, notes, coverImageUrl, artistIds });
    res.json({ message: 'Album updated', data: record, status: 200 });
  } catch (error) {
    if (isPrismaError(error, 'P2003')) return next(new ConflictError('one of artistIds does not exist.'));
    next(error);
  }
};

export const deleteAlbum = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = routeParam(req.params.id);
    const existing = await getAlbumService(id);
    if (!existing) throw new NotFoundError(`Album id:${id} not found.`);
    await deleteAlbumService(id);
    res.json({ message: 'Album deleted', data: null, status: 200 });
  } catch (error) {
    next(error);
  }
};
