import NextAuth, { type NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import type { EmailConfig } from 'next-auth/providers/email';
import { cookies, headers } from 'next/headers';
import { getConfig } from '@/lib/config';
import { backendSignIn } from '@/lib/backendSignIn';
import { authAdapter } from '@/lib/authAdapter';
import { sendMagicLink } from '@/lib/magicLink';

/**
 * Auth.js (#73). JWT sessions in an encrypted cookie (auth_secret): the FE
 * never touches the database. Every sign-in goes through the BE
 * (backendSignIn), which creates or finds the user and checks Turnstile; the
 * session only carries the BE's user id. Live status and admin come from
 * GET /api/auth/me on each request (lib/session.ts), never from the cookie.
 *
 * Magic links (#74): the email provider needs an adapter, but only for
 * verification tokens, which live in the BE (lib/authAdapter.ts). Sending
 * goes BE → mailer (lib/magicLink.ts); following the link signs in through
 * the BE like any other provider.
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

// A link is good for 15 minutes: it proves the address and signs in at once.
const MAGIC_LINK_MAX_AGE = 15 * 60;

export const authConfig = (): NextAuthConfig => {
  const config = getConfig();
  return {
    secret: config.authSecret,
    adapter: authAdapter,
    // Behind the Cloudflare Tunnel. Production pins the origin with AUTH_URL
    // (config.ts requires https://PUBLIC_HOSTNAME), so Host only matters in dev.
    trustHost: true,
    session: { strategy: 'jwt' },
    pages: { signIn: '/sign-in', error: '/sign-in', verifyRequest: '/sign-in/check-email' },
    providers: [
      { id: 'email', type: 'email', name: 'Email', maxAge: MAGIC_LINK_MAX_AGE, sendVerificationRequest: sendMagicLink } satisfies EmailConfig,
      ...(config.google
        // select_account: always show Google's chooser, so a device with one
        // signed-in Google account can't pick the wrong one silently (#124).
        ? [Google({
            clientId: config.google.clientId,
            clientSecret: config.google.clientSecret,
            authorization: { params: { prompt: 'select_account' } },
          })]
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
      async signIn({ user, account, profile, email }) {
        if (account?.provider === 'email') {
          // Asking for a link: the BE checks Turnstile when it's asked to send.
          if (email?.verificationRequest) return true;
          // Following the link: Auth.js has spent the token, so the address is proven.
          if (!user.email) return false;
          const beUser = await backendSignIn({ provider: 'email', email: user.email }, { clientIp: clientIp(await headers()) });
          if (!beUser) return false;
          user.id = beUser.id; // carried through the adapter's createUser into the jwt callback
          return true;
        }
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
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
