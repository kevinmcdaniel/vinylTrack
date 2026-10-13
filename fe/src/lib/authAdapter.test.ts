// @vitest-environment node
// Server-only code: run in Node, not jsdom (jose rejects jsdom's cross-realm Uint8Array).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { decodeJwt } from 'jose';
import { authAdapter } from './authAdapter';
import { stubAppEnv } from '@/tests/env';

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
});
