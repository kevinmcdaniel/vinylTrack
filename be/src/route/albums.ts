import express from 'express';
import { listAlbums, getAlbum, createAlbum, updateAlbum, deleteAlbum } from '../controller/album.js';

export const albumRoute = express.Router();

albumRoute.get('/', listAlbums);
albumRoute.get('/:id', getAlbum);
albumRoute.post('/', createAlbum);
albumRoute.patch('/:id', updateAlbum);
albumRoute.delete('/:id', deleteAlbum);
