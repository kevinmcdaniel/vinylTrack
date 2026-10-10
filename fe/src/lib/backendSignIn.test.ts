// @vitest-environment node
// Server-only code: run in Node, not jsdom (jose rejects jsdom's cross-realm Uint8Array).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { decodeJwt } from 'jose';
import { backendSignIn } from './backendSignIn';
import { stubAppEnv } from '@/tests/env';

// What Auth.js's signIn hook calls (#73): the BE decides, the FE only forwards.
const ok = (data: unknown) => new Response(JSON.stringify({ data, status: 200 }), { status: 200, headers: { 'content-type': 'application/json' } });
const fail = (status: number) => new Response(JSON.stringify({ data: null, status, message: 'nope' }), { status, headers: { 'content-type': 'application/json' } });

describe('backendSignIn', () => {
  beforeEach(() => stubAppEnv());
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it('posts provider, identity and Turnstile token with a service token, client IP and automation header', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok({ id: 'u-1', status: 'pending', isAdmin: false }));
    const user = await backendSignIn(
      { provider: 'google', email: 'a@example.com', name: 'A', avatar: 'https://x/a.png' },
      { turnstileToken: 'tok', clientIp: '203.0.113.9', automationKey: 'auto' },
    );
    expect(user).toEqual({ id: 'u-1', status: 'pending', isAdmin: false });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://vinyl.be:3000/api/auth/sign-in');
    const headers = init!.headers as Record<string, string>;
    expect(decodeJwt(headers.Authorization!.replace('Bearer ', '')).sub).toBe('service:fe');
    expect(headers['x-client-ip']).toBe('203.0.113.9');
    expect(headers['x-automation-key']).toBe('auto');
    expect(JSON.parse(init!.body as string)).toEqual({ provider: 'google', email: 'a@example.com', name: 'A', avatar: 'https://x/a.png', turnstileToken: 'tok' });
  });

  it('omits the optional headers when there is nothing to forward', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(ok({ id: 'u-1', status: 'active', isAdmin: true }));
    await backendSignIn({ provider: 'dev', email: 'kevin@example.com' }, { turnstileToken: 'tok' });
    const headers = fetchMock.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers).not.toHaveProperty('x-client-ip');
    expect(headers).not.toHaveProperty('x-automation-key');
  });

  it('returns null when the BE refuses (bad Turnstile, unknown dev user)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(fail(401));
    await expect(backendSignIn({ provider: 'dev', email: 'nobody@example.com' }, { turnstileToken: 'tok' })).resolves.toBeNull();
  });

  it('throws on an unexpected BE failure, so sign-in errors rather than silently failing', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(fail(500));
    await expect(backendSignIn({ provider: 'google', email: 'a@example.com' }, { turnstileToken: 'tok' })).rejects.toThrow();
  });
});