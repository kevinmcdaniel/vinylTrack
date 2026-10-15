import { NextResponse, type NextRequest } from 'next/server';

/**
 * Optimistic sign-in check (#94). (app)/loading.tsx streams the shell with a
 * 200 before a page's requireActiveUser() runs, so a signed-out visitor would
 * only get a client-side redirect. Here, with no session cookie at all, the
 * answer is a real 307 to /sign-in before rendering starts.
 *
 * Cookie presence only: no JWT decrypt, no BE call, since this runs on every
 * request. A stale or forged cookie passes, and lib/session.ts (the real
 * gate) redirects as before. Never put an access check here (CLAUDE.md).
 */

// Auth.js's session cookie (`defaultCookies` in @auth/core), with the
// __Secure- prefix it adds over https. proxy.test.ts holds these to Auth.js.
export const SESSION_COOKIES = ['authjs.session-token', '__Secure-authjs.session-token'] as const;

// A large session is split into `<name>.0`, `<name>.1`, …
const hasSession = (request: NextRequest) =>
  request.cookies.getAll().some(({ name }) => SESSION_COOKIES.some((s) => name === s || name.startsWith(`${s}.`)));

// A server action POST. A 307 would keep the method and the action id, so a
// tab left open past cookie expiry would get "failed to find server action"
// rather than the sign-in page. Let it through: the action's own
// requireActiveUser() redirect comes back as an action redirect, as before.
const isServerAction = (request: NextRequest) =>
  request.method === 'POST' && request.headers.has('next-action');

export function proxy(request: NextRequest) {
  if (hasSession(request) || isServerAction(request)) return NextResponse.next();
  return NextResponse.redirect(new URL('/sign-in', request.url));
}

export const config = {
  matcher: [
    // Everything but signing in, Auth.js's routes, the compose healthcheck
    // (/api/health), Next's assets and files with an extension (favicon, public/).
    '/((?!sign-in(?:/|$)|api/auth(?:/|$)|api/health$|_next/static|_next/image|.*\\.[^/]+$).*)',
  ],
};
