import express, { type Request } from 'express';
import { listCopies, getCopy, createCopy, updateCopy, deleteCopy } from '../controller/copy.js';
import { requireActiveUser } from '../common/authorize.js';
import { requireCollectionAccess, requireCollectionAccessForCreate } from '../common/policy.js';
import { routeParam } from '../common/utils.js';
import { prisma } from '../database.js';

const resolveByCopyId = async (req: Request) => {
  const copy = await prisma.copy.findUnique({
    where: { id: routeParam(req.params.id) },
    select: { album: { select: { collectionId: true } } },
  });
  return copy?.album.collectionId ?? null;
};

const resolveByAlbumIdInBody = async (req: Request): Promise<string | undefined> => {
  const albumId = req.body.albumId as string | undefined;
  if (!albumId) return undefined;
  const album = await prisma.album.findUnique({ where: { id: albumId }, select: { collectionId: true } });
  return album?.collectionId;
};

export const copyRoute = express.Router();

copyRoute.use(requireActiveUser);

copyRoute.get('/', listCopies);
copyRoute.get('/:id', requireCollectionAccess(resolveByCopyId), getCopy);
copyRoute.post('/', requireCollectionAccessForCreate(resolveByAlbumIdInBody), createCopy);
copyRoute.patch('/:id', requireCollectionAccess(resolveByCopyId), updateCopy);
copyRoute.delete('/:id', requireCollectionAccess(resolveByCopyId), deleteCopy);
