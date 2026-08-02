import { Router } from 'express';
import { healthRoute } from './health.js';
import { artistRoute } from './artists.js';

export const indexRoute = Router();

indexRoute.use('/health', healthRoute);
indexRoute.use('/artist', artistRoute);
