// @vitest-environment node
// Server-only code: run in Node, not jsdom (jose rejects jsdom's cross-realm Uint8Array).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { decodeJwt } from 'jose';
import { AuthError } from 'next-auth';
import { sendMagicLink, MagicLinkError } from './magicLink';
import { stubAppEnv } from '@/tests/env';

// The email provider's sendVerificationRequest (#74): BE checks Turnstile, the mailer sends.
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const link = 'http://localhost:5201/api/auth/callback/email?callbackUrl=%2F&token=abc&email=a%40example.com';
// What Auth.js hands sendVerificationRequest: the form fields as JSON, plus the browser's headers.
const request = (body: Record<string, string>, headers: Record<string, string> = {}) =>
  new Request('http://localhost:5201/api/auth/signin/email', { method: 'POST', headers, body: JSON.stringify(body) });
const params = (req = request({ email: 'a@example.com', turnstileToken: 'tok', callbackUrl: '/' })) => ({ identifier: 'a@example.com', url: link, request: req });

describe('sendMagicLink', () => {
  beforeEach(() => stubAppEnv());
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it('asks the BE to send the link, with the Turnstile token, a service token, client IP and automation header', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ data: { sent: true }, status: 200 }));
    await sendMagicLink(params(request({ email: 'a@example.com', turnstileToken: 'tok', callbackUrl: '/' }, { 'cf-connecting-ip': '203.0.113.9', 'x-automation-key': 'auto' })));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://vinyl.be:3000/api/auth/magic-link');
    const headers = init!.headers as Record<string, string>;
    expect(decodeJwt(headers.Authorization!.replace('Bearer ', '')).sub).toBe('service:fe');
    expect(headers['x-client-ip']).toBe('203.0.113.9');
    expect(headers['x-automation-key']).toBe('auto');
    expect(JSON.parse(init!.body as string)).toEqual({ email: 'a@example.com', url: link, turnstileToken: 'tok' });
  });

  it('omits the optional headers when there is nothing to forward', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ data: { sent: true }, status: 200 }));
    await sendMagicLink(params());
    const headers = fetchMock.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers).not.toHaveProperty('x-client-ip');
    expect(headers).not.toHaveProperty('x-automation-key');
  });

  it.each([
    [429, 'rate-limited'],
    [401, 'refused'],
    [406, 'refused'],
    [502, 'failed'],
    [500, 'failed'],
  ] as const)('turns a BE %i into a MagicLinkError (%s), logged without the address or link', async (status, reason) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ data: {}, status }, status));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = await sendMagicLink(params()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MagicLinkError);
    // An AuthError is what Auth.js rethrows to the server action instead of swallowing.
    expect(error).toBeInstanceOf(AuthError);
    expect((error as MagicLinkError).type).toBe('EmailSignInError');
    expect((error as MagicLinkError).reason).toBe(reason);
    const logged = warn.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logged).toContain(String(status));
    expect(logged).not.toContain('a@example.com');
    expect(logged).not.toContain('token=abc');
  });

  it('treats an unreachable BE as failed', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(sendMagicLink(params())).rejects.toMatchObject({ reason: 'failed' });
  });
});
