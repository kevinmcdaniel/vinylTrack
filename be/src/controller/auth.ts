import type { NextFunction, Request, Response } from 'express';
import { ValidationError } from '../common/errorHandler.js';
import { getConfig } from '../config.js';
import { prisma } from '../database.js';
import { signInUser, type SignInProvider } from '../service/auth.js';
import { createVerificationTokenService, useVerificationTokenService } from '../service/verificationToken.js';
import { assertOnlyFields } from '../common/utils.js';
import { sendMagicLink } from '../common/mailerClient.js';

const PROVIDERS: readonly SignInProvider[] = ['google', 'email', 'dev'];

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

const tokenFields = (body: unknown, allowed: string[]) => {
  assertOnlyFields(body, allowed, (m) => new ValidationError(m));
  const { identifier, token, expires } = (body ?? {}) as Record<string, unknown>;
  if (typeof identifier !== 'string' || identifier === '') throw new ValidationError('identifier is required.');
  if (typeof token !== 'string' || token === '') throw new ValidationError('token is required.');
  return { identifier, token, expires };
};

// Auth.js adapter: createVerificationToken (#74). FE service only.
export const createVerificationToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { identifier, token, expires } = tokenFields(req.body, ['identifier', 'token', 'expires']);
    const expiresAt = typeof expires === 'string' ? new Date(expires) : new Date(NaN);
    if (Number.isNaN(expiresAt.getTime())) throw new ValidationError('expires must be an ISO date.');
    const record = await createVerificationTokenService({ identifier, token, expires: expiresAt });
    res.status(201).json({ message: 'Verification token stored', data: record, status: 201 });
  } catch (error) {
    next(error);
  }
};

// Auth.js adapter: useVerificationToken (#74). null = unknown, used or expired.
export const useVerificationToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { identifier, token } = tokenFields(req.body, ['identifier', 'token']);
    const record = await useVerificationTokenService(identifier, token);
    res.json({ message: record ? 'Verification token used' : 'No such token', data: record, status: 200 });
  } catch (error) {
    next(error);
  }
};

const EMAIL = /^[^\s@<>,;:"()[\]\\]+@[^\s@<>,;:"()[\]\\]+\.[^\s@<>,;:"()[\]\\]+$/;

// Auth.js email provider's sendVerificationRequest (#74). Turnstile has
// already run (route). The answer is the same whether or not the address
// belongs to a user, so this can't be used to discover accounts.
export const magicLink = async (req: Request, res: Response, next: NextFunction) => {
  try {
    assertOnlyFields(req.body, ['email', 'url', 'turnstileToken'], (m) => new ValidationError(m));
    const { email, url } = (req.body ?? {}) as Record<string, unknown>;
    if (typeof email !== 'string' || !EMAIL.test(email.trim())) throw new ValidationError('A valid email is required.');
    if (typeof url !== 'string' || url === '') throw new ValidationError('url is required.');
    const result = await sendMagicLink(email.trim().toLowerCase(), url);
    if (result === 'sent') return res.json({ message: 'Sign-in link sent', data: { sent: true }, status: 200 });
    if (result === 'rate-limited') return res.status(429).json({ message: 'Too many sign-in emails; try again later.', data: {}, status: 429 });
    // The mailer refused the link itself: the FE built a URL off the allowlist.
    if (result === 'rejected') throw new ValidationError('The sign-in link was refused.');
    return res.status(502).json({ message: 'Could not send the sign-in email.', data: {}, status: 502 });
  } catch (error) {
    next(error);
  }
};
