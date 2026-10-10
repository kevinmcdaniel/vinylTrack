import type { NextFunction, Request, Response } from 'express';
import { ValidationError } from '../common/errorHandler.js';
import { getConfig } from '../config.js';
import { prisma } from '../database.js';
import { signInUser, type SignInProvider } from '../service/auth.js';

const PROVIDERS: readonly SignInProvider[] = ['google', 'dev'];

// Called by Auth.js's signIn callback in the FE, with a service token.
export const signIn = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { provider, email, name, avatar } = req.body ?? {};
    if (!PROVIDERS.includes(provider)) throw new ValidationError(`provider must be one of ${PROVIDERS.join(', ')}.`);
    if (typeof email !== 'string') throw new ValidationError('email is required.');
    const user = await signInUser(prisma, { provider, email, name, avatar }, { allowDev: getConfig().devIdentityHeader });
    res.json({ message: 'Signed in', data: user, status: 200 });
  } catch (error) {
    next(error);
  }
};
