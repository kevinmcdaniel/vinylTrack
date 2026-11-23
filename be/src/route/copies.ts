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

// `undefined` = no usable album reference (controller 406s); `null` = no such
// album, which the guard treats as inaccessible so it can't be told apart
// from one (#45). A new album (#123) names its collection directly.
const resolveByAlbumInBody = async (req: Request): Promise<string | null | undefined> => {
  const { albumId, album } = (req.body ?? {}) as { albumId?: unknown; album?: unknown };
  if (album !== undefined) {
    if (albumId !== undefined || typeof album !== 'object' || album === null) return undefined;
    const { collectionId } = album as { collectionId?: unknown };
    return typeof collectionId === 'string' && collectionId ? collectionId : undefined;
  }
  if (typeof albumId !== 'string' || !albumId) return undefined;
  const existing = await prisma.album.findUnique({ where: { id: albumId }, select: { collectionId: true } });
  return existing?.collectionId ?? null;
};

export const copyRoute = express.Router();

copyRoute.use(requireActiveUser);

copyRoute.get('/', listCopies);
copyRoute.get('/:id', requireCollectionAccess(resolveByCopyId), getCopy);
copyRoute.post('/', requireCollectionAccessForCreate(resolveByAlbumInBody), createCopy);
copyRoute.patch('/:id', requireCollectionAccess(resolveByCopyId), updateCopy);
copyRoute.delete('/:id', requireCollectionAccess(resolveByCopyId), deleteCopy);
