import express, { type Request } from 'express';
import { listCollections, getCollection, createCollection } from '../controller/collection.js';
import { requireActiveUser } from '../common/authorize.js';
import { requireCollectionAccess } from '../common/policy.js';
import { routeParam } from '../common/utils.js';

// The resource *is* the collection, so the access check resolves to the route
// param itself — an inaccessible collection reads as 404, same as album/copy/want.
const resolveSelf = async (req: Request) => routeParam(req.params.id) || null;

export const collectionRoute = express.Router();

collectionRoute.use(requireActiveUser);

// Create (#73) so an empty production can start; rename/delete/share are #14,
// and admin-delete semantics for a collection you don't own are open in #26.
collectionRoute.get('/', listCollections);
collectionRoute.post('/', createCollection);
collectionRoute.get('/:id', requireCollectionAccess(resolveSelf), getCollection);
