import express, { type Request } from 'express';
import { listAlbums, getAlbum, createAlbum, updateAlbum, deleteAlbum } from '../controller/album.js';
import { requireActiveUser } from '../common/authorize.js';
import { requireCollectionAccess, requireCollectionAccessForCreate } from '../common/policy.js';
import { routeParam } from '../common/utils.js';
import { prisma } from '../database.js';

const resolveByAlbumId = async (req: Request) => {
  const album = await prisma.album.findUnique({ where: { id: routeParam(req.params.id) }, select: { collectionId: true } });
  return album?.collectionId ?? null;
};

export const albumRoute = express.Router();

albumRoute.use(requireActiveUser);

albumRoute.get('/', listAlbums);
albumRoute.get('/:id', requireCollectionAccess(resolveByAlbumId), getAlbum);
albumRoute.post('/', requireCollectionAccessForCreate((req) => req.body.collectionId), createAlbum);
albumRoute.patch('/:id', requireCollectionAccess(resolveByAlbumId), updateAlbum);
albumRoute.delete('/:id', requireCollectionAccess(resolveByAlbumId), deleteAlbum);
