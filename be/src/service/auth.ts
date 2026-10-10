// auth.ts - sign-in: the only place users are created (#73, #11).
import { Prisma, type PrismaClient } from '../generated/client/client.js';
import { AuthError, ValidationError } from '../common/errorHandler.js';

export type SignInProvider = 'google' | 'dev';
export type SignInInput = { provider: SignInProvider; email: string; name?: string | null; avatar?: string | null };
export type SignedInUser = { id: string; email: string; name: string | null; status: string; isAdmin: boolean };

// Never allowAutomation: it isn't readable through the API (#11).
const select = { id: true, email: true, name: true, status: true, isAdmin: true } as const;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ATTEMPTS = 5;

// A lost race: Prisma's P2034, or (through the pg driver adapter) a
// DriverAdapterError for TransactionWriteConflict; P2002 if both inserted the
// same email. All mean "retry and look again".
function isWriteConflict(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return error.code === 'P2034' || error.code === 'P2002';
  if (!(error instanceof Error)) return false;
  const kind = (error.cause as { kind?: unknown } | undefined)?.kind;
  return kind === 'TransactionWriteConflict' || /TransactionWriteConflict|could not serialize/i.test(error.message);
}

// Emails are stored lowercase from here on, but match any existing row
// regardless of case, so nobody gets a second account over capitalisation.
const byEmail = (email: string) => ({ email: { equals: email, mode: 'insensitive' as const } });

// Google (or, later, magic link): find the user by email, or create one.
// The very first user ever, on a completely empty user table, becomes an
// active admin; everyone after that starts pending and needs approval.
// Dev provider (development/test only): signs in an existing user, never creates.
export async function signInUser(db: PrismaClient, input: SignInInput, opts: { allowDev: boolean }): Promise<SignedInUser> {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL.test(email)) throw new ValidationError('A valid email is required.');

  if (input.provider === 'dev') {
    if (!opts.allowDev) throw new AuthError('The dev sign-in is not available here.');
    const user = await db.user.findFirst({ where: byEmail(email), select });
    if (!user) throw new AuthError('No such seeded user.');
    return user;
  }

  // Count + insert in one serializable transaction, so two simultaneous first
  // sign-ins can't both see an empty table: the loser gets a serialization
  // failure, retries, and sees the winner's row.
  for (let attempt = 1; ; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          const existing = await tx.user.findFirst({ where: byEmail(email), select });
          if (existing) return existing;
          const first = (await tx.user.count()) === 0;
          return tx.user.create({
            data: {
              email,
              name: input.name ?? null,
              avatar: input.avatar ?? null,
              status: first ? 'active' : 'pending',
              isAdmin: first,
            },
            select,
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (!isWriteConflict(error) || attempt >= MAX_ATTEMPTS) throw error;
      await new Promise((r) => setTimeout(r, Math.random() * 20 * attempt));
    }
  }
}
