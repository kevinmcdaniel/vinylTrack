import express, { type Request } from 'express';
import {
  listCollections,
  getCollection,
  createCollection,
  updateCollection,
  listShares,
  listShareCandidates,
  addShare,
  removeShare,
} from '../controller/collection.js';
import { requireActiveUser } from '../common/authorize.js';
import { requireCollectionAccess, requireCollectionOwner } from '../common/policy.js';
import { routeParam } from '../common/utils.js';

// The resource *is* the collection, so the access check resolves to the route
// param itself — an inaccessible collection reads as 404, same as album/copy/want.
const resolveSelf = async (req: Request) => routeParam(req.params.id) || null;

export const collectionRoute = express.Router();

collectionRoute.use(requireActiveUser);

// Create (#73) so an empty production can start; rename and shares are the
// owner's settings (#125). Delete stays open in #26.
collectionRoute.get('/', listCollections);
collectionRoute.post('/', createCollection);
collectionRoute.get('/:id', requireCollectionAccess(resolveSelf), getCollection);
collectionRoute.patch('/:id', requireCollectionOwner(resolveSelf), updateCollection);
collectionRoute.get('/:id/share', requireCollectionOwner(resolveSelf), listShares);
collectionRoute.get('/:id/share/candidates', requireCollectionOwner(resolveSelf), listShareCandidates);
collectionRoute.post('/:id/share', requireCollectionOwner(resolveSelf), addShare);
collectionRoute.delete('/:id/share/:userId', requireCollectionOwner(resolveSelf), removeShare);
