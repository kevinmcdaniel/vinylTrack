import { Router } from 'express';
import { healthRoute } from './health.js';
import { artistRoute } from './artists.js';
import { albumRoute } from './albums.js';

export const indexRoute = Router();

indexRoute.use('/health', healthRoute);
indexRoute.use('/artist', artistRoute);
indexRoute.use('/album', albumRoute);
