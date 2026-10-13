import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../database.js';
import { getConfig } from '../config.js';
import { signInternalToken } from '../common/internalToken.js';
import { cleanupTestData } from './setup.js';

// POST /api/auth/magic-link (#74): FE service + Turnstile → the mailer.
const service = async () => ({ Authorization: `Bearer ${await signInternalToken({ kind: 'service' }, getConfig().internalApiSecret)}` });
const url = 'http://localhost:5201/api/auth/callback/email?token=abc&email=a%40example.com';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const turnstileOk = { success: true, hostname: 'example.com', 'error-codes': [], metadata: { result_with_testing_key: true } };

// Route fetch by URL: Cloudflare siteverify vs the mailer.
const stub = ({ turnstile = turnstileOk, mailer = () => json({ data: { sent: true }, status: 200 }) }: { turnstile?: object; mailer?: () => Response } = {}) => {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const u = String(input);
    calls.push({ url: u, init: init ?? {} });
    if (u.includes('challenges.cloudflare.com')) return json(turnstile);
    return mailer();
  });
  return calls;
};

beforeAll(async () => { await cleanupTestData(); });
afterEach(() => vi.restoreAllMocks());
afterAll(async () => { await cleanupTestData(); });

describe('POST /api/auth/magic-link', () => {
  it('asks the mailer to send the link, with the mailer token, and says sent', async () => {
    const calls = stub();
    const res = await request(app).post('/api/auth/magic-link').set(await service())
      .send({ email: 'Someone@Example.com', url, turnstileToken: 'tok' });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ sent: true });
    const mailerCall = calls.find((c) => c.url.endsWith('/magic-link'))!;
    expect(mailerCall.url).toBe(`${getConfig().mailer!.url}/magic-link`);
    expect((mailerCall.init.headers as Record<string, string>).Authorization).toBe(`Bearer ${getConfig().mailer!.token}`);
    expect(JSON.parse(mailerCall.init.body as string)).toEqual({ to: 'someone@example.com', url });
    expect(mailerCall.init.signal).toBeInstanceOf(AbortSignal);
  });

  it('answers the same whether or not the address belongs to a user (no account discovery)', async () => {
    stub();
    const known = await request(app).post('/api/auth/magic-link').set(await service()).send({ email: 'kevin@example.com', url, turnstileToken: 'tok' });
    stub();
    const unknown = await request(app).post('/api/auth/magic-link').set(await service()).send({ email: 'nobody-at-all@example.com', url, turnstileToken: 'tok' });
    expect(unknown.status).toBe(known.status);
    expect(unknown.body).toEqual(known.body);
  });

  it('401s without a service token, and sends nothing', async () => {
    const calls = stub();
    const user = await prisma.user.create({ data: { email: '_TEST_ml-user@example.com', status: 'active' } });
    const userToken = await signInternalToken({ kind: 'user', userId: user.id }, getConfig().internalApiSecret);
    for (const headers of [{}, { Authorization: `Bearer ${userToken}` }]) {
      expect((await request(app).post('/api/auth/magic-link').set(headers).send({ email: 'a@example.com', url, turnstileToken: 'tok' })).status).toBe(401);
    }
    expect(calls.some((c) => c.url.endsWith('/magic-link'))).toBe(false);
  });

  it('401s a failed Turnstile check, and sends nothing', async () => {
    const calls = stub({ turnstile: { success: false, 'error-codes': ['invalid-input-response'] } });
    const res = await request(app).post('/api/auth/magic-link').set(await service()).send({ email: 'a@example.com', url, turnstileToken: 'tok' });
    expect(res.status).toBe(401);
    expect(calls.some((c) => c.url.endsWith('/magic-link'))).toBe(false);
  });

  it('406s a bad email or unexpected fields, before calling the mailer', async () => {
    for (const body of [{ email: 'not-an-email', url, turnstileToken: 'tok' }, { email: 'a@example.com', url, turnstileToken: 'tok', subject: 'hi' }, { email: 'a@example.com', turnstileToken: 'tok' }]) {
      const calls = stub();
      expect((await request(app).post('/api/auth/magic-link').set(await service()).send(body)).status, JSON.stringify(body)).toBe(406);
      expect(calls.some((c) => c.url.endsWith('/magic-link'))).toBe(false);
      vi.restoreAllMocks();
    }
  });

  it('passes on the mailer rate limit as 429', async () => {
    stub({ mailer: () => json({ data: {}, status: 429, message: 'Too many' }, 429) });
    expect((await request(app).post('/api/auth/magic-link').set(await service()).send({ email: 'a@example.com', url, turnstileToken: 'tok' })).status).toBe(429);
  });

  it('502s when the mailer fails or is unreachable', async () => {
    stub({ mailer: () => json({ data: {}, status: 502 }, 502) });
    expect((await request(app).post('/api/auth/magic-link').set(await service()).send({ email: 'a@example.com', url, turnstileToken: 'tok' })).status).toBe(502);
    vi.restoreAllMocks();
    stub({ mailer: () => { throw new TypeError('fetch failed'); } });
    expect((await request(app).post('/api/auth/magic-link').set(await service()).send({ email: 'a@example.com', url, turnstileToken: 'tok' })).status).toBe(502);
  });
});
