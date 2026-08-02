import express from 'express';
import { listArtists, getArtist, createArtist, updateArtist, deleteArtist } from '../controller/artist.js';
import { requireActiveUser, requireAdmin } from '../common/authorize.js';

export const artistRoute = express.Router();

artistRoute.use(requireActiveUser);

artistRoute.get('/', listArtists);
artistRoute.get('/:id', getArtist);
artistRoute.post('/', createArtist);
artistRoute.patch('/:id', updateArtist);
artistRoute.delete('/:id', requireAdmin, deleteArtist);
