'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { signOut } from '@/auth';
import { getConfig } from '@/lib/config';
import { signInternalToken } from '@/lib/internalToken';
import { requireSessionUserId } from '@/lib/session';

// A declined user asks again (#11). Not apiPost: that requires an active user.
export async function requestAccessAgain(formData: FormData) {
  const userId = await requireSessionUserId();
  const config = getConfig();
  const h = await headers();
  const forward: Record<string, string> = {};
  const ip = h.get('cf-connecting-ip');
  const automation = h.get('x-automation-key');
  if (ip) forward['x-client-ip'] = ip;
  if (automation) forward['x-automation-key'] = automation;
  const token = formData.get('turnstileToken');
  await fetch(`${config.apiBaseUrl}/auth/request-access`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${await signInternalToken({ kind: 'user', userId }, config.internalApiSecret)}`,
      ...forward,
    },
    body: JSON.stringify({ turnstileToken: typeof token === 'string' ? token : '' }),
    cache: 'no-store',
  });
  redirect('/pending');
}

export async function signOutAction() {
  await signOut({ redirectTo: '/sign-in' });
}
