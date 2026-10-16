import 'server-only';
import { getConfig } from './config';
import { signInternalToken } from './internalToken';
import { requireActiveUser } from './session';
import { ApiError } from './apiError';

/**
 * Server-side API client.
 *
 * Deliberately server-only: the BE mounts no CORS middleware, so a call
 * straight from the browser to :5202 would fail — and routing through Server
 * Components keeps the dev identity header off the client entirely.
 */

export { ApiError } from './apiError';

const baseUrl = () => getConfig().apiBaseUrl;

// Every call carries a short-lived token for the signed-in, active user (#73);
// requireActiveUser redirects to sign-in or the waiting screen otherwise.
const authHeaders = async (): Promise<Record<string, string>> => {
  const user = await requireActiveUser();
  const token = await signInternalToken({ kind: 'user', userId: user.id }, getConfig().internalApiSecret);
  return { Authorization: `Bearer ${token}` };
};

export type QueryValue = string | undefined | null;

export async function apiGet<T>(path: string, params?: Record<string, QueryValue>): Promise<T> {
  const url = new URL(`${baseUrl()}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString(), {
    headers: await authHeaders(),
    // Browse data changes as the family adds records; never serve a stale list.
    cache: 'no-store',
  });

  return unwrap<T>(res, path);
}

// Every write goes through here as the signed-in, active user (#73). DELETE
// carries no body, so it sends no content-type either.
async function send<T>(method: 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: body === undefined ? headers : { ...headers, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: 'no-store',
  });
  return unwrap<T>(res, path);
}

/** POST a JSON body. */
export const apiPost = <T>(path: string, body: unknown): Promise<T> => send<T>('POST', path, body);

/** PATCH a JSON body (#102). */
export const apiPatch = <T>(path: string, body: unknown): Promise<T> => send<T>('PATCH', path, body);

/** DELETE; the BE answers `data: null` on success (#102). */
export const apiDelete = <T = null>(path: string): Promise<T> => send<T>('DELETE', path);

async function unwrap<T>(res: Response, path: string): Promise<T> {
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, body?.message ?? `Request to ${path} failed with ${res.status}`);
  }
  // A 2xx with an unparseable or non-envelope body still has to fail as an
  // ApiError: pages catch that type, so a bare TypeError from dereferencing
  // null would escape them and surface as a 500.
  if (body === null || typeof body !== 'object' || !('data' in body)) {
    throw new ApiError(res.status, `Request to ${path} returned ${res.status} with no response envelope.`);
  }
  return body.data as T;
}
