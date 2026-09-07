import express, { type Request } from 'express';
import { listLocations, getLocation, createLocation, updateLocation, deleteLocation } from '../controller/location.js';
import { requireActiveUser } from '../common/authorize.js';
import { requireCollectionAccess, requireCollectionAccessForCreate } from '../common/policy.js';
import { routeParam } from '../common/utils.js';
import { prisma } from '../database.js';

// A location is a child of a collection (#53), so it is scoped exactly like
// album/copy/want_item — no more owner special case.
const resolveByLocationId = async (req: Request) => {
  const location = await prisma.location.findUnique({
    where: { id: routeParam(req.params.id) },
    select: { collectionId: true },
  });
  return location?.collectionId ?? null;
};

const resolveByCollectionIdInBody = (req: Request): string | undefined =>
  req.body.collectionId as string | undefined;

export const locationRoute = express.Router();

locationRoute.use(requireActiveUser);

locationRoute.get('/', listLocations);
locationRoute.get('/:id', requireCollectionAccess(resolveByLocationId), getLocation);
locationRoute.post('/', requireCollectionAccessForCreate(resolveByCollectionIdInBody), createLocation);
locationRoute.patch('/:id', requireCollectionAccess(resolveByLocationId), updateLocation);
locationRoute.delete('/:id', requireCollectionAccess(resolveByLocationId), deleteLocation);
