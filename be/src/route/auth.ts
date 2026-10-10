import express from 'express';
import { requireService, requireSignedInUser } from '../common/authorize.js';
import { verifyTurnstile } from '../common/turnstile.js';
import { prisma } from '../database.js';
import { signIn } from '../controller/auth.js';
import { requestAccess } from '../controller/user.js';

export const authRoute = express.Router();

// For automation mode, the user acted for is the one signing in (#11).
const signingInUser = async (req: express.Request) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  return (await prisma.user.findUnique({ where: { email }, select: { allowAutomation: true } })) ?? undefined;
};

authRoute.post('/sign-in', requireService, verifyTurnstile('sign-in', signingInUser), signIn);

// A denied user asks again (#11). For automation mode, the user acted for is the caller.
const caller = async (req: express.Request) =>
  req.user ? ((await prisma.user.findUnique({ where: { id: req.user.id }, select: { allowAutomation: true } })) ?? undefined) : undefined;
authRoute.post('/request-access', requireSignedInUser, verifyTurnstile('request-access', caller), requestAccess);
