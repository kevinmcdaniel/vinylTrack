import { Router } from 'express';
import { getConfig } from '../config.js';

export const healthRoute = Router();

healthRoute.get('/', (_req, res) => {
  res.status(200).json({ data: { status: 'ok', version: getConfig().version } });
});
