import express from 'express';
import { requireService, requireSignedInUser } from '../common/authorize.js';
import { verifyTurnstile } from '../common/turnstile.js';
import { prisma } from '../database.js';
import { signIn, createVerificationToken, useVerificationToken, magicLink } from '../controller/auth.js';
import { requestAccess, me } from '../controller/user.js';

export const authRoute = express.Router();

// For automation mode, the user acted for is the one signing in (#11).
const signingInUser = async (req: express.Request) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  return (await prisma.user.findUnique({ where: { email }, select: { allowAutomation: true } })) ?? undefined;
};

// A magic-link sign-in (#74) skips Turnstile: the requester passed it to get
// the email, and the single-use 15-minute link proves they own the inbox.
// Google and dev sign-ins carry a Turnstile token as before.
const signInTurnstile = verifyTurnstile('sign-in', signingInUser);
authRoute.post('/sign-in', requireService, (req, res, next) =>
  req.body?.provider === 'email' ? next() : signInTurnstile(req, res, next), signIn);

authRoute.get('/me', requireSignedInUser, me);

// Magic-link token storage for the FE's Auth.js adapter (#74).
authRoute.post('/verification-token', requireService, createVerificationToken);
authRoute.post('/verification-token/use', requireService, useVerificationToken);

// Send a magic link (#74): Turnstile first; automation acts for the user with that email.
authRoute.post('/magic-link', requireService, verifyTurnstile('magic-link', signingInUser), magicLink);

// A denied user asks again (#11). For automation mode, the user acted for is the caller.
const caller = async (req: express.Request) =>
  req.user ? ((await prisma.user.findUnique({ where: { id: req.user.id }, select: { allowAutomation: true } })) ?? undefined) : undefined;
authRoute.post('/request-access', requireSignedInUser, verifyTurnstile('request-access', caller), requestAccess);
