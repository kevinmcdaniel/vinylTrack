// verificationToken.ts - magic-link token storage for Auth.js's adapter (#74).
import { Prisma } from '../generated/client/client.js';
import { prisma } from '../database.js';

export type VerificationToken = { identifier: string; token: string; expires: Date };

export const createVerificationTokenService = (data: VerificationToken) =>
  prisma.verification_token.create({ data });

// Single use: the row is deleted as it's read, so a second click (or a
// concurrent one) finds nothing. Expired tokens are deleted too, and refused.
export async function useVerificationTokenService(identifier: string, token: string): Promise<VerificationToken | null> {
  try {
    const row = await prisma.verification_token.delete({ where: { identifier_token: { identifier, token } } });
    return row.expires.getTime() > Date.now() ? row : null;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') return null;
    throw error;
  }
}
