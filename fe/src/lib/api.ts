import 'server-only';

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

const baseUrl = () => `${process.env.BE_URL}:${process.env.BE_PORT_INT}/api`;

// The single place real auth (#11) swaps in: today the caller is resolved from
// this dev header (#26), later from the session.
const identityHeaders = (): Record<string, string> => {
  const email = process.env.AUTH_BOOTSTRAP_OWNER_EMAIL;
  return email ? { 'x-user-email': email } : {};
};

export type QueryValue = string | undefined | null;

export async function apiGet<T>(path: string, params?: Record<string, QueryValue>): Promise<T> {
  const url = new URL(`${baseUrl()}${path}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString(), {
    headers: { ...identityHeaders() },
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
