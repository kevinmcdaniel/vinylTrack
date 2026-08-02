import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../database.js';
import { AuthError, ForbiddenError } from './errorHandler.js';

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  status: string;
  isAdmin: boolean;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// Dev-only identity resolution, ahead of real auth (#11, tracked as scaffolding
// in #26). Caller supplies `x-user-email` and gets looked up against the seeded
// `user` table; missing header falls back to AUTH_BOOTSTRAP_OWNER_EMAIL. #11
// replaces this middleware's body with a real JWT decode into req.user — the
// req.user shape, and everything downstream that reads it, should not need to
// change when that happens.
export const identifyUser = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const header = req.headers['x-user-email'];
    const email = typeof header === 'string' && header.length > 0 ? header : process.env.AUTH_BOOTSTRAP_OWNER_EMAIL;
    if (email) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (user) req.user = user;
    }
    next();
  } catch (error) {
    next(error);
  }
};

export const requireActiveUser = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) return next(new AuthError('No authenticated user.'));
  if (req.user.status !== 'active') return next(new AuthError(`User status '${req.user.status}' is not active.`));
  next();
};

export const requireAdmin = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user?.isAdmin) return next(new ForbiddenError('Admin access required.'));
  next();
};
