import express from 'express';
import { listArtists, getArtist, createArtist, updateArtist, deleteArtist } from '../controller/artist.js';

export const artistRoute = express.Router();

artistRoute.get('/', listArtists);
artistRoute.get('/:id', getArtist);
artistRoute.post('/', createArtist);
artistRoute.patch('/:id', updateArtist);
artistRoute.delete('/:id', deleteArtist);
