import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp, type Sender } from '../app.js';
import { createRateLimiter } from '../rateLimit.js';
import type { Config } from '../config.js';

// POST /magic-link and GET /health (#62).
const TOKEN = 't'.repeat(32);
const config: Config = {
  appEnv: 'production', port: 3000, version: 'v1.2.3', mode: 'gmail', from: 'vinyltrack@example.org',
  mailerToken: TOKEN, linkOrigin: 'https://vinyl.example.org',
};
const goodUrl = 'https://vinyl.example.org/api/auth/callback/email?token=abc';

type LogFn = (...parts: unknown[]) => void;
let sender: Sender & { send: ReturnType<typeof vi.fn<Sender['send']>> };
let log: ReturnType<typeof vi.fn<LogFn>>;
let healthy: boolean;
const limiters = () => ({
  limiter: createRateLimiter({ limit: 3, windowMs: 900_000, now: () => 0 }),
  globalLimiter: createRateLimiter({ limit: 30, windowMs: 900_000, now: () => 0 }),
});
const app = () => createApp({ config, sender, ...limiters(), log, isHealthy: () => healthy });
const post = (body: object, token: string | null = TOKEN) => {
  const r = request(app()).post('/magic-link');
  return (token ? r.set('Authorization', `Bearer ${token}`) : r).send(body);
};

beforeEach(() => {
  sender = { send: vi.fn<Sender['send']>(async () => {}) };
  log = vi.fn<LogFn>();
  healthy = true;
});

describe('POST /magic-link', () => {
  it('sends the fixed email for a good request', async () => {
    const res = await post({ to: 'a@example.com', url: goodUrl });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ sent: true });
    expect(sender.send).toHaveBeenCalledTimes(1);
    expect(sender.send.mock.calls[0]![0]).toMatchObject({ to: 'a@example.com', subject: 'Sign in to vinylTrack' });
  });

  it('401s a missing or wrong bearer token, and sends nothing', async () => {
    expect((await post({ to: 'a@example.com', url: goodUrl }, null)).status).toBe(401);
    expect((await post({ to: 'a@example.com', url: goodUrl }, 'x'.repeat(32))).status).toBe(401);
    expect(sender.send).not.toHaveBeenCalled();
  });

  it.each([
    'https://evil.example.com/api/auth/callback/email?token=abc',
    'http://vinyl.example.org/api/auth/callback/email?token=abc',
    'https://vinyl.example.org.evil.com/x',
    'https://vinyl.example.org@evil.com/x',
    'javascript:alert(1)',
    'not a url',
  ])('406s a link outside the app: %s', async (url) => {
    expect((await post({ to: 'a@example.com', url })).status).toBe(406);
    expect(sender.send).not.toHaveBeenCalled();
  });

  it.each([
    'a@example.com, b@example.com',
    'a@example.com\r\nBcc: victim@example.com',
    'not-an-email',
    '',
  ])('406s anything but one valid recipient: %j', async (to) => {
    expect((await post({ to, url: goodUrl })).status).toBe(406);
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('406s unexpected fields (no custom subject or body, ever)', async () => {
    expect((await post({ to: 'a@example.com', url: goodUrl, subject: 'hi' })).status).toBe(406);
  });

  it('429s the fourth request for one recipient in the window', async () => {
    const shared = createApp({ config, sender, ...limiters(), log, isHealthy: () => true });
    const send = () => request(shared).post('/magic-link').set('Authorization', `Bearer ${TOKEN}`).send({ to: 'a@example.com', url: goodUrl });
    for (let i = 0; i < 3; i++) expect((await send()).status).toBe(200);
    expect((await send()).status).toBe(429);
    expect(sender.send).toHaveBeenCalledTimes(3);
  });

  it('counts +tag and Gmail dot variants as the same recipient', async () => {
    const shared = createApp({ config, sender, ...limiters(), log, isHealthy: () => true });
    const send = (to: string) => request(shared).post('/magic-link').set('Authorization', `Bearer ${TOKEN}`).send({ to, url: goodUrl });
    for (const to of ['someone@gmail.com', 'some.one+1@gmail.com', 'Some.One+2@GMAIL.com']) expect((await send(to)).status).toBe(200);
    expect((await send('s.o.m.e.o.n.e+3@googlemail.com')).status).toBe(429);
  });

  it('429s once the global cap is reached, whoever the recipients are', async () => {
    const shared = createApp({
      config, sender, log, isHealthy: () => true,
      limiter: createRateLimiter({ limit: 3, windowMs: 900_000, now: () => 0 }),
      globalLimiter: createRateLimiter({ limit: 5, windowMs: 900_000, now: () => 0 }),
    });
    const send = (i: number) => request(shared).post('/magic-link').set('Authorization', `Bearer ${TOKEN}`).send({ to: `p${i}@example.com`, url: goodUrl });
    for (let i = 0; i < 5; i++) expect((await send(i)).status).toBe(200);
    expect((await send(99)).status).toBe(429);
    expect(sender.send).toHaveBeenCalledTimes(5);
  });

  it('does not use up a recipient\'s allowance on a request the global cap refuses', async () => {
    const perRecipient = createRateLimiter({ limit: 3, windowMs: 900_000, now: () => 0 });
    const full = createApp({ config, sender, log, isHealthy: () => true, limiter: perRecipient,
      globalLimiter: createRateLimiter({ limit: 1, windowMs: 900_000, now: () => 0 }) });
    const sendVia = (a: ReturnType<typeof createApp>, to: string) =>
      request(a).post('/magic-link').set('Authorization', `Bearer ${TOKEN}`).send({ to, url: goodUrl });
    expect((await sendVia(full, 'a@example.com')).status).toBe(200);
    expect((await sendVia(full, 'b@example.com')).status).toBe(429); // global cap
    // Same per-recipient limiter, fresh global cap: b still has all 3.
    const fresh = createApp({ config, sender, log, isHealthy: () => true, limiter: perRecipient,
      globalLimiter: createRateLimiter({ limit: 30, windowMs: 900_000, now: () => 0 }) });
    for (let i = 0; i < 3; i++) expect((await sendVia(fresh, 'b@example.com')).status).toBe(200);
  });

  it('answers malformed JSON with a 400 envelope, no HTML and no stack trace', async () => {
    const res = await request(app()).post('/magic-link').set('Authorization', `Bearer ${TOKEN}`)
      .set('content-type', 'application/json').send('{"to": ');
    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body).toMatchObject({ data: null, status: 400 });
    expect(JSON.stringify(res.body)).not.toMatch(/at |stack|node_modules/);
  });

  it('answers an oversized body with a 413 envelope', async () => {
    const res = await request(app()).post('/magic-link').set('Authorization', `Bearer ${TOKEN}`)
      .send({ to: 'a@example.com', url: goodUrl + 'x'.repeat(5000) });
    expect(res.status).toBe(413);
    expect(res.body).toMatchObject({ data: null, status: 413 });
  });

  it('502s when the sender fails', async () => {
    sender.send.mockRejectedValueOnce(new Error('gmail down'));
    expect((await post({ to: 'a@example.com', url: goodUrl })).status).toBe(502);
  });

  it('logs only the recipient domain and the result, never the address or the link', async () => {
    await post({ to: 'secret.person@example.com', url: goodUrl });
    const logged = log.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logged).toContain('example.com');
    expect(logged).not.toContain('secret.person');
    expect(logged).not.toContain('token=abc');
  });
});

describe('GET /health', () => {
  it('reports ok with the version while the Gmail token works', async () => {
    const res = await request(app()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ status: 'ok', version: 'v1.2.3', mode: 'gmail' });
  });

  it('503s once the token is revoked', async () => {
    healthy = false;
    expect((await request(app()).get('/health')).status).toBe(503);
  });
});
