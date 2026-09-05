import type { NextFunction, Request, Response } from 'express';
import { NotFoundError } from '../common/errorHandler.js';
import { routeParam } from '../common/utils.js';
import { accessibleCollectionIds } from '../common/policy.js';
import { listCollectionsService, getCollectionService } from '../service/collection.js';

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
