import { describe, it, expect, vi } from 'vitest';
import { checkTurnstile, type TurnstileDeps, type TurnstileInput } from '../common/turnstile.js';

// verifyTurnstile's core (#73, #11): the BE validates every token against
// siteverify; automation mode swaps the secret, never skips validation.
const REAL = '0x4AAAAAAAreal-secret';
const TEST_PASS = '1x0000000000000000000000000000000AA';
const AUTO_KEY = 'automation-key-0123456789';

type SiteverifyBody = Record<string, unknown>;
const realOk = (over: SiteverifyBody = {}): SiteverifyBody =>
  ({ success: true, action: 'sign-in', hostname: 'vinyl.example.org', 'error-codes': [], ...over });
const testOk: SiteverifyBody = { success: true, hostname: 'example.com', 'error-codes': [], metadata: { result_with_testing_key: true } };

const deps = (body: SiteverifyBody, over: Partial<TurnstileDeps['config']> = {}) => {
  const fetch = vi.fn(async (_url: string, init: { body: URLSearchParams }) => {
    void init;
    return { ok: true, json: async () => body };
  });
  const log = vi.fn();
  const d: TurnstileDeps = {
    config: { secretKey: REAL, expectedHostname: 'vinyl.example.org', ...over },
    fetch: fetch as unknown as TurnstileDeps['fetch'],
    log,
  };
  return { d, fetch, log, sent: () => Object.fromEntries((fetch.mock.calls[0]![1].body as URLSearchParams).entries()) };
};

const input = (over: Partial<TurnstileInput> = {}): TurnstileInput =>
  ({ token: 'tok', action: 'sign-in', remoteIp: '203.0.113.9', ...over });

describe('checkTurnstile: regular path', () => {
  it('passes a good token and sends secret, response, remoteip and an idempotency key', async () => {
    const { d, sent } = deps(realOk());
    await expect(checkTurnstile(input(), d)).resolves.toEqual({ ok: true, mode: 'regular' });
    expect(sent()).toMatchObject({ secret: REAL, response: 'tok', remoteip: '203.0.113.9' });
    expect(sent().idempotency_key).toMatch(/^[0-9a-f-]{36}$/);
  });

  it.each([
    ['a missing token', input({ token: undefined }), realOk()],
    ['success: false', input(), realOk({ success: false, 'error-codes': ['invalid-input-response'] })],
    ['a replayed token', input(), realOk({ success: false, 'error-codes': ['timeout-or-duplicate'] })],
    ['the wrong action', input(), realOk({ action: 'request-access' })],
    ['the wrong hostname', input(), realOk({ hostname: 'evil.example.com' })],
  ])('fails %s', async (_label, inp, body) => {
    const { d } = deps(body);
    await expect(checkTurnstile(inp, d)).resolves.toMatchObject({ ok: false });
  });

  it('does not call siteverify for a missing token', async () => {
    const { d, fetch } = deps(realOk());
    await checkTurnstile(input({ token: '' }), d);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fails closed when siteverify is unreachable', async () => {
    const { d } = deps(realOk());
    d.fetch = vi.fn(async () => { throw new Error('network down'); }) as unknown as TurnstileDeps['fetch'];
    await expect(checkTurnstile(input(), d)).resolves.toMatchObject({ ok: false });
  });

  it("with Cloudflare's test secret (dev), expects the testing-key result instead of action/hostname", async () => {
    const { d } = deps(testOk, { secretKey: TEST_PASS });
    await expect(checkTurnstile(input(), d)).resolves.toEqual({ ok: true, mode: 'regular' });
    const fake = deps(realOk(), { secretKey: TEST_PASS });  // a "real" answer to a test secret is wrong
    await expect(checkTurnstile(input(), fake.d)).resolves.toMatchObject({ ok: false });
  });
});

describe('checkTurnstile: automation mode', () => {
  const auto = { key: AUTO_KEY, testSecretKey: TEST_PASS };

  it('uses the test secret when the key matches and the user opted in, and logs it', async () => {
    const { d, sent, log } = deps(testOk, { automation: auto });
    const result = await checkTurnstile(input({ automationKey: AUTO_KEY, automationUser: { allowAutomation: true } }), d);
    expect(result).toEqual({ ok: true, mode: 'automation' });
    expect(sent().secret).toBe(TEST_PASS);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('automation'));
  });

  it('401s a wrong key and never falls back to the regular path', async () => {
    const { d, fetch, log } = deps(realOk(), { automation: auto });
    const result = await checkTurnstile(input({ automationKey: 'wrong', automationUser: { allowAutomation: true } }), d);
    expect(result).toMatchObject({ ok: false });
    expect(fetch).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalled();
  });

  it('401s a correct key for a user without allowAutomation, or no user at all', async () => {
    for (const automationUser of [{ allowAutomation: false }, undefined]) {
      const { d, fetch } = deps(testOk, { automation: auto });
      await expect(checkTurnstile(input({ automationKey: AUTO_KEY, automationUser }), d)).resolves.toMatchObject({ ok: false });
      expect(fetch).not.toHaveBeenCalled();
    }
  });

  it('ignores the header when automation mode is not configured (production)', async () => {
    const { d, sent } = deps(realOk());
    const result = await checkTurnstile(input({ automationKey: AUTO_KEY, automationUser: { allowAutomation: true } }), d);
    expect(result).toEqual({ ok: true, mode: 'regular' });
    expect(sent().secret).toBe(REAL);
  });
});
