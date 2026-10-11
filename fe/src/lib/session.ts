import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getConfig } from './config';
import { signInternalToken } from './internalToken';

/**
 * The session data-access layer (#73; Next's recommended pattern: check close
 * to the data, not in layouts). The BE is still the real gate: it re-reads the
 * user on every request. This only picks the right screen.
 */
export type CurrentUser = { id: string; email: string; name: string | null; avatar: string | null; status: 'pending' | 'active' | 'denied'; isAdmin: boolean };

// Signed in at all? Otherwise to the sign-in page.
export const requireSessionUserId = cache(async (): Promise<string> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) redirect('/sign-in');
  return id;
});

// The caller as the BE sees them right now, or null when there is no session
// or the BE no longer knows it (user deleted, secret rotated, reseed). The
// sign-in page uses this, not the cookie alone: a stale cookie that bounced to
// / would come straight back here, forever.
export const findCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const id = (await auth())?.user?.id;
  if (!id) return null;
  const config = getConfig();
  const res = await fetch(`${config.apiBaseUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${await signInternalToken({ kind: 'user', userId: id }, config.internalApiSecret)}` },
    cache: 'no-store',
  });
  if (res.status === 401 || res.status === 404) return null;
  if (!res.ok) throw new Error(`GET /auth/me failed with ${res.status}`);
  return (await res.json()).data as CurrentUser;
});

// The caller as the BE sees them right now, whatever their status.
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const user = await findCurrentUser();
  if (!user) redirect('/sign-in');
  return user;
});

// Approved? Otherwise to the waiting/denied screen.
export const requireActiveUser = cache(async (): Promise<CurrentUser> => {
  const user = await getCurrentUser();
  if (user.status !== 'active') redirect('/pending');
  return user;
});

// Admin pages.
export const requireAdmin = cache(async (): Promise<CurrentUser> => {
  const user = await requireActiveUser();
  if (!user.isAdmin) redirect('/');
  return user;
});
