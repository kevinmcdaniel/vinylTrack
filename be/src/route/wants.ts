import express, { type Request } from 'express';
import {
  listWantItems,
  createWantItem,
  updateWantItem,
  deleteWantItem,
  markWantItemFound,
} from '../controller/want.js';
import { requireActiveUser } from '../common/authorize.js';
import { requireCollectionAccess, requireCollectionAccessForCreate } from '../common/policy.js';
import { routeParam } from '../common/utils.js';
import { prisma } from '../database.js';

const resolveByWantId = async (req: Request) => {
  const want = await prisma.want_item.findUnique({ where: { id: routeParam(req.params.id) }, select: { collectionId: true } });
  return want?.collectionId ?? null;
};

export const wantRoute = express.Router();

wantRoute.use(requireActiveUser);

wantRoute.get('/', listWantItems);
wantRoute.post('/', requireCollectionAccessForCreate((req) => req.body.collectionId), createWantItem);
wantRoute.patch('/:id', requireCollectionAccess(resolveByWantId), updateWantItem);
wantRoute.delete('/:id', requireCollectionAccess(resolveByWantId), deleteWantItem);
wantRoute.post('/:id/found', requireCollectionAccess(resolveByWantId), markWantItemFound);
