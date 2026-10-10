import 'server-only';
import { getConfig } from './config';
import { signInternalToken } from './internalToken';

export type SignInProvider = 'google' | 'dev';
export type BackendUser = { id: string; status: 'pending' | 'active' | 'denied'; isAdmin: boolean };

/**
 * Asks the BE to sign someone in (#73). The BE creates or finds the user,
 * checks Turnstile, and bootstraps the first admin; the FE only forwards.
 * Returns null when the BE refuses (bad bot check, unknown dev user), and
 * throws on anything unexpected so a broken BE errors instead of looking like
 * "wrong password".
 */
export async function backendSignIn(
  identity: { provider: SignInProvider; email: string; name?: string | null; avatar?: string | null },
  context: { turnstileToken?: string; clientIp?: string; automationKey?: string },
): Promise<BackendUser | null> {
  const config = getConfig();
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    Authorization: `Bearer ${await signInternalToken({ kind: 'service' }, config.internalApiSecret)}`,
  };
  if (context.clientIp) headers['x-client-ip'] = context.clientIp;
  if (context.automationKey) headers['x-automation-key'] = context.automationKey;

  const res = await fetch(`${config.apiBaseUrl}/auth/sign-in`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...identity, turnstileToken: context.turnstileToken }),
    cache: 'no-store',
  });
  if (res.status === 401 || res.status === 406) return null;
  if (!res.ok) throw new Error(`Sign-in failed: BE answered ${res.status}`);
  const body = await res.json();
  return body.data as BackendUser;
}
