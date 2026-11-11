import express, { type Request } from 'express';
import { listAlbums, listAlbumMatches, getAlbum, createAlbum, updateAlbum, deleteAlbum } from '../controller/album.js';
import { requireActiveUser } from '../common/authorize.js';
import { collectionIdInBody, requireCollectionAccess, requireCollectionAccessForCreate } from '../common/policy.js';
import { routeParam } from '../common/utils.js';
import { prisma } from '../database.js';

const resolveByAlbumId = async (req: Request) => {
  const album = await prisma.album.findUnique({ where: { id: routeParam(req.params.id) }, select: { collectionId: true } });
  return album?.collectionId ?? null;
};

export const albumRoute = express.Router();

albumRoute.use(requireActiveUser);

albumRoute.get('/', listAlbums);
// Before /:id, or 'matches' would be read as an album id.
albumRoute.get('/matches', listAlbumMatches);
albumRoute.get('/:id', requireCollectionAccess(resolveByAlbumId), getAlbum);
albumRoute.post('/', requireCollectionAccessForCreate(collectionIdInBody), createAlbum);
albumRoute.patch('/:id', requireCollectionAccess(resolveByAlbumId), updateAlbum);
albumRoute.delete('/:id', requireCollectionAccess(resolveByAlbumId), deleteAlbum);
