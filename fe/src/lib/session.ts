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

// The caller as the BE sees them right now, whatever their status.
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  const id = await requireSessionUserId();
  const config = getConfig();
  const res = await fetch(`${config.apiBaseUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${await signInternalToken({ kind: 'user', userId: id }, config.internalApiSecret)}` },
    cache: 'no-store',
  });
  // The session names a user the BE no longer knows (or the token was refused).
  if (res.status === 401 || res.status === 404) redirect('/sign-in');
  if (!res.ok) throw new Error(`GET /auth/me failed with ${res.status}`);
  return (await res.json()).data as CurrentUser;
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
