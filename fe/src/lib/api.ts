import 'server-only';
import { getConfig } from './config';
import { signInternalToken } from './internalToken';
import { requireActiveUser } from './session';

/**
 * Server-side API client.
 *
 * Deliberately server-only: the BE mounts no CORS middleware, so a call
 * straight from the browser to :5202 would fail — and routing through Server
 * Components keeps the dev identity header off the client entirely.
 */

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
  get notFound(): boolean {
    return this.status === 404;
  }
}

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
