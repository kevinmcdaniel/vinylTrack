import { Router } from 'express';
import { healthRoute } from './health.js';
import { artistRoute } from './artists.js';
import { albumRoute } from './albums.js';
import { locationRoute } from './locations.js';
import { copyRoute } from './copies.js';

export const indexRoute = Router();

indexRoute.use('/health', healthRoute);
indexRoute.use('/artist', artistRoute);
indexRoute.use('/album', albumRoute);
indexRoute.use('/location', locationRoute);
indexRoute.use('/copy', copyRoute);
