import { Router } from 'express';
import { healthRoute } from './health.js';

export const indexRoute = Router();

indexRoute.use('/health', healthRoute);
