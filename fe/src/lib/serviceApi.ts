import 'server-only';
import { getConfig } from './config';
import { signInternalToken } from './internalToken';

/**
 * A POST from the FE acting as itself (service token), for the auth routes
 * that run before anyone is signed in (#74). Client IP and automation key
 * are forwarded so the BE's Turnstile check sees the browser, not the FE.
 */
export async function servicePost(
  path: string,
  body: unknown,
  context: { clientIp?: string; automationKey?: string } = {},
): Promise<Response> {
  const config = getConfig();
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    Authorization: `Bearer ${await signInternalToken({ kind: 'service' }, config.internalApiSecret)}`,
  };
  if (context.clientIp) headers['x-client-ip'] = context.clientIp;
  if (context.automationKey) headers['x-automation-key'] = context.automationKey;
  return fetch(`${config.apiBaseUrl}${path}`, { method: 'POST', headers, body: JSON.stringify(body), cache: 'no-store' });
}
