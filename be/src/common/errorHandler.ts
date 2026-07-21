import type { NextFunction, Request, Response } from 'express';

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof NotFoundError) {
    res.status(404).json({ data: null, error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ data: null, error: 'Internal server error' });
};
