import type { NextFunction, Request, Response } from 'express';
import { getConfig, type Config } from '../config.js';
import { prisma } from '../database.js';
import { AuthError, ForbiddenError } from './errorHandler.js';
import { verifyInternalToken, type InternalIdentity } from './internalToken.js';

// Never includes allowAutomation: it isn't readable through the API (#11).
const userSelect = { id: true, email: true, name: true, status: true, isAdmin: true } as const;

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
      // Set when the FE calls as itself (a service token), e.g. sign-in.
      service?: 'fe';
    }
  }
}

// Who is calling (#73, replacing #26's dev stub):
// - `Authorization: Bearer <token>` signed by the FE with internal_api_secret
//   (common/internalToken.ts). A user token sets req.user; a service token
//   sets req.service = 'fe' and no user.
// - `x-user-email`, development/test only (config.devIdentityHeader), for the
//   BE suite and Bruno.
// - Nothing presented → no req.user → requireActiveUser 401s. There is no
//   fallback identity, and a bad token never falls back to the header.
// Status is re-read from the database on every request, so approving, denying
// or demoting someone takes effect immediately.
export const identifyUserWith = (config: () => Config) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const auth = req.headers.authorization;
      if (typeof auth === 'string' && auth.length > 0) {
        const match = /^Bearer (.+)$/.exec(auth);
        if (!match) return next(new AuthError('Malformed Authorization header.'));
        let identity: InternalIdentity;
        try {
          identity = await verifyInternalToken(match[1]!, config().internalApiSecret);
        } catch {
          return next(new AuthError('Invalid or expired token.'));
        }
        if (identity.kind === 'service') {
          req.service = 'fe';
        } else {
          const user = await prisma.user.findUnique({ where: { id: identity.userId }, select: userSelect });
          if (user) req.user = user;
        }
        return next();
      }

      const header = req.headers['x-user-email'];
      if (config().devIdentityHeader && typeof header === 'string' && header.length > 0) {
        const user = await prisma.user.findUnique({ where: { email: header }, select: userSelect });
        if (user) req.user = user;
      }
      next();
    } catch (error) {
      next(error);
    }
  };

export const identifyUser = identifyUserWith(getConfig);

export const requireActiveUser = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) return next(new AuthError('No authenticated user.'));
  if (req.user.status !== 'active') return next(new AuthError(`User status '${req.user.status}' is not active.`));
  next();
};

// Signed in, whatever the status: for the few routes a pending or denied user
// may call, e.g. asking for access again.
export const requireSignedInUser = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) return next(new AuthError('No authenticated user.'));
  next();
};

// Routes only the FE itself may call (a service token), e.g. sign-in.
export const requireService = (req: Request, _res: Response, next: NextFunction) => {
  if (req.service !== 'fe') return next(new AuthError('Service token required.'));
  next();
};

export const requireAdmin = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user?.isAdmin) return next(new ForbiddenError('Admin access required.'));
  next();
};
