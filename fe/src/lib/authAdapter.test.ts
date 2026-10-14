// @vitest-environment node
// Server-only code: run in Node, not jsdom (jose rejects jsdom's cross-realm Uint8Array).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { decodeJwt } from 'jose';
import { authAdapter } from './authAdapter';
import { stubAppEnv } from '@/tests/env';
// Auth.js's own login handler, imported by path (it isn't in the package's
// exports) so these tests break if an upgrade asks the adapter for more.
import { handleLoginOrRegister } from '../../node_modules/@auth/core/lib/actions/callback/handle-login.js';

// Auth.js adapter for magic links (#74): tokens live in the BE, users come from BE sign-in.
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const expires = new Date('2026-10-13T12:15:00.000Z');

describe('authAdapter', () => {
  beforeEach(() => stubAppEnv());
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it('stores a verification token in the BE, with a service token', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ data: { identifier: 'a@example.com', token: 'h', expires: expires.toISOString() }, status: 201 }, 201));
    const stored = await authAdapter.createVerificationToken!({ identifier: 'a@example.com', token: 'h', expires });
    expect(stored).toEqual({ identifier: 'a@example.com', token: 'h', expires });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://vinyl.be:3000/api/auth/verification-token');
    expect(decodeJwt((init!.headers as Record<string, string>).Authorization!.replace('Bearer ', '')).sub).toBe('service:fe');
    expect(JSON.parse(init!.body as string)).toEqual({ identifier: 'a@example.com', token: 'h', expires: expires.toISOString() });
  });

  it('uses a token once: the BE row comes back with expires as a Date', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ data: { identifier: 'a@example.com', token: 'h', expires: expires.toISOString() }, status: 200 }));
    await expect(authAdapter.useVerificationToken!({ identifier: 'a@example.com', token: 'h' })).resolves.toEqual({ identifier: 'a@example.com', token: 'h', expires });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://vinyl.be:3000/api/auth/verification-token/use');
    expect(JSON.parse(init!.body as string)).toEqual({ identifier: 'a@example.com', token: 'h' });
  });

  it('returns null for an unknown, used or expired token', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ data: null, status: 200 }));
    await expect(authAdapter.useVerificationToken!({ identifier: 'a@example.com', token: 'h' })).resolves.toBeNull();
  });

  it.each([
    ['create', () => authAdapter.createVerificationToken!({ identifier: 'a@example.com', token: 'h', expires })],
    ['use', () => authAdapter.useVerificationToken!({ identifier: 'a@example.com', token: 'h' })],
  ])('throws when the BE fails to %s a token, rather than signing anyone in', async (_label, call) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ data: null, status: 500 }, 500));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(call()).rejects.toThrow();
  });

  it('never looks users up, so the FE has no account discovery to leak', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    await expect(authAdapter.getUserByEmail!('a@example.com')).resolves.toBeNull();
    await expect(authAdapter.getUser!('u-1')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('createUser hands back the user the signIn callback already resolved through the BE', async () => {
    const user = { id: 'be-user-1', email: 'a@example.com', emailVerified: new Date() };
    await expect(authAdapter.createUser!(user)).resolves.toBe(user);
  });

  // What Auth.js passes handleLoginOrRegister for a JWT-session app. '' = no session cookie.
  const options = (provider: Record<string, unknown> = {}) => ({
    adapter: authAdapter, events: {}, jwt: {},
    session: { strategy: 'jwt', generateSessionToken: () => 'unused' },
    provider: { account: () => ({}), ...provider },
    cookies: { sessionToken: { name: 'authjs.session-token' } },
  }) as unknown as Parameters<typeof handleLoginOrRegister>[3];

  it('carries the BE user id through Auth.js\'s Google (OAuth) login path', async () => {
    // The signIn callback has already swapped in the BE id (src/auth.ts).
    const user = { id: 'be-user-1', email: 'a@example.com', name: 'A' };
    const account = { provider: 'google', type: 'oidc' as const, providerAccountId: 'google-sub-1' };
    await expect(authAdapter.getUserByAccount!({ provider: 'google', providerAccountId: 'google-sub-1' })).resolves.toBeNull();
    const result = await handleLoginOrRegister('', user, account, options({ id: 'google' }));
    expect(result.user.id).toBe('be-user-1');
    expect(result.isNewUser).toBe(true);
  });

  it('carries the BE user id through Auth.js\'s email login path', async () => {
    const user = { id: 'be-user-2', email: 'a@example.com', emailVerified: null };
    const account = { provider: 'email', type: 'email' as const, providerAccountId: 'a@example.com' };
    const result = await handleLoginOrRegister('', user, account, options({ id: 'email' }));
    expect(result.user.id).toBe('be-user-2');
  });

  it('ignores a stale session cookie rather than linking to it', async () => {
    const user = { id: 'be-user-3', email: 'a@example.com' };
    const account = { provider: 'google', type: 'oidc' as const, providerAccountId: 'google-sub-3' };
    const result = await handleLoginOrRegister('not-a-real-jwt', user, account, options({ id: 'google' }));
    expect(result.user.id).toBe('be-user-3');
  });
});
