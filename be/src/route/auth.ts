import express from 'express';
import { requireService } from '../common/authorize.js';
import { verifyTurnstile } from '../common/turnstile.js';
import { prisma } from '../database.js';
import { signIn } from '../controller/auth.js';

export const authRoute = express.Router();

// For automation mode, the user acted for is the one signing in (#11).
const signingInUser = async (req: express.Request) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  return (await prisma.user.findUnique({ where: { email }, select: { allowAutomation: true } })) ?? undefined;
};

authRoute.post('/sign-in', requireService, verifyTurnstile('sign-in', signingInUser), signIn);
