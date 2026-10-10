import NextAuth, { type NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { cookies, headers } from 'next/headers';
import { getConfig } from '@/lib/config';
import { backendSignIn } from '@/lib/backendSignIn';

/**
 * Auth.js (#73). JWT sessions in an encrypted cookie (auth_secret): the FE
 * never touches the database. Every sign-in goes through the BE
 * (backendSignIn), which creates or finds the user and checks Turnstile; the
 * session only carries the BE's user id. Live status and admin come from
 * GET /api/auth/me on each request (lib/session.ts), never from the cookie.
 */

// Set by the sign-in page's server action just before redirecting to Google,
// read (and cleared) when Google sends the user back.
export const TURNSTILE_COOKIE = 'vt_turnstile';

declare module 'next-auth' {
  interface Session {
    user: { id: string; email?: string | null; name?: string | null; image?: string | null };
  }
}

const clientIp = (h: Headers) => h.get('cf-connecting-ip') ?? undefined;
const automationKey = (h: Headers) => h.get('x-automation-key') ?? undefined;

export const { handlers, auth, signIn, signOut } = NextAuth((): NextAuthConfig => {
  const config = getConfig();
  return {
    secret: config.authSecret,
    // Behind the Cloudflare Tunnel and the FE's own host check.
    trustHost: true,
    session: { strategy: 'jwt' },
    pages: { signIn: '/sign-in', error: '/sign-in' },
    providers: [
      ...(config.google
        ? [Google({ clientId: config.google.clientId, clientSecret: config.google.clientSecret })]
        : []),
      // "Sign in as a seeded user": development/test only, still decided by the BE.
      ...(config.devSignIn
        ? [
            Credentials({
              id: 'dev',
              name: 'Dev sign-in',
              credentials: { email: {}, turnstileToken: {} },
              async authorize(credentials, request) {
                const email = typeof credentials?.email === 'string' ? credentials.email : '';
                const user = await backendSignIn(
                  { provider: 'dev', email },
                  {
                    turnstileToken: typeof credentials?.turnstileToken === 'string' ? credentials.turnstileToken : undefined,
                    clientIp: clientIp(request.headers),
                    automationKey: automationKey(request.headers),
                  },
                );
                return user ? { id: user.id, email } : null;
              },
            }),
          ]
        : []),
    ],
    callbacks: {
      async signIn({ user, account, profile }) {
        if (account?.provider !== 'google') return true; // dev sign-in already went through the BE
        if (!user.email || profile?.email_verified !== true) return false;
        const cookieStore = await cookies();
        const turnstileToken = cookieStore.get(TURNSTILE_COOKIE)?.value;
        cookieStore.delete(TURNSTILE_COOKIE);
        const h = await headers();
        const beUser = await backendSignIn(
          { provider: 'google', email: user.email, name: user.name, avatar: user.image },
          { turnstileToken, clientIp: clientIp(h), automationKey: automationKey(h) },
        );
        if (!beUser) return false;
        user.id = beUser.id; // carried into the jwt callback below
        return true;
      },
      jwt({ token, user }) {
        if (user?.id) token.uid = user.id;
        return token;
      },
      session({ session, token }) {
        if (typeof token.uid === 'string') session.user.id = token.uid;
        return session;
      },
    },
  };
});
