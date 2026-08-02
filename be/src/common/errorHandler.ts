import type { NextFunction, Request, Response } from 'express';

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export const errorHandler = (err: Error, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err instanceof AuthError) {
    res.status(401).json({ data: null, message: err.message, status: 401 });
  } else if (err instanceof ValidationError) {
    res.status(406).json({ data: {}, message: err.message, status: 406 });
  } else if (err instanceof ConflictError) {
    res.status(409).json({ data: {}, message: err.message, status: 409 });
  } else if (err instanceof NotFoundError) {
    res.status(404).json({ data: null, message: err.message, status: 404 });
  } else {
    console.error('default error handler:', err);
    res.status(500).json({ data: {}, message: 'Internal server error', status: 500 });
  }
};
