import { Router } from 'express';

export const healthRoute = Router();

healthRoute.get('/', (_req, res) => {
  res.status(200).json({ data: { status: 'ok' } });
});
