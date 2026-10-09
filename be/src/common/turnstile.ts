// turnstile.ts - Cloudflare Turnstile, validated by the BE only (#73, #11).
//
// The FE renders the widget and forwards the raw token; this decides whether it
// passed. Automation mode (e2e, #40) swaps in the test secret when the
// x-automation-key header matches AND the user being acted for has
// allowAutomation; it never skips validation, and a wrong key never falls back.
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { getConfig } from '../config.js';
import { AuthError } from './errorHandler.js';

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
// Cloudflare's published test secrets. Production refuses them at startup.
const TEST_SECRET = /^[123]x0+AA$/;
// What siteverify reports for any token checked with a test secret.
const TEST_HOSTNAME = 'example.com';

export type TurnstileAction = 'sign-in' | 'request-access' | 'magic-link';

export type TurnstileInput = {
  token: string | undefined;
  action: TurnstileAction;
  remoteIp?: string;
  automationKey?: string;
  automationUser?: { allowAutomation: boolean };
};

export type TurnstileDeps = {
  config: { secretKey: string; expectedHostname: string; automation?: { key: string; testSecretKey: string } };
  fetch: (url: string, init: { method: string; body: URLSearchParams }) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;
  log: (message: string) => void;
};

export type TurnstileResult = { ok: true; mode: 'regular' | 'automation' } | { ok: false; reason: string };

type Siteverify = {
  success?: boolean;
  action?: string;
  hostname?: string;
  'error-codes'?: string[];
  metadata?: { result_with_testing_key?: boolean };
};

// Hash both sides first so timingSafeEqual sees equal lengths whatever was sent.
const sameKey = (a: string, b: string) =>
  timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());

export async function checkTurnstile(input: TurnstileInput, deps: TurnstileDeps): Promise<TurnstileResult> {
  const { config, log } = deps;
  let secret = config.secretKey;
  let mode: 'regular' | 'automation' = 'regular';

  // Automation mode only exists when configured (never in production); there,
  // the header is simply ignored and the regular secret applies.
  if (input.automationKey !== undefined && config.automation) {
    if (!sameKey(input.automationKey, config.automation.key)) {
      log(`turnstile automation: wrong key (action ${input.action})`);
      return { ok: false, reason: 'automation key mismatch' };
    }
    if (!input.automationUser?.allowAutomation) {
      log(`turnstile automation: user not allowed (action ${input.action})`);
      return { ok: false, reason: 'user not allowed automation' };
    }
    secret = config.automation.testSecretKey;
    mode = 'automation';
  }

  if (!input.token) return { ok: false, reason: 'missing token' };

  let body: Siteverify;
  try {
    const params = new URLSearchParams({ secret, response: input.token, idempotency_key: randomUUID() });
    if (input.remoteIp) params.set('remoteip', input.remoteIp);
    const res = await deps.fetch(SITEVERIFY, { method: 'POST', body: params });
    body = (await res.json()) as Siteverify;
  } catch (error) {
    log(`turnstile: siteverify unreachable (${error instanceof Error ? error.message : String(error)})`);
    return { ok: false, reason: 'siteverify unreachable' };
  }

  let result: TurnstileResult;
  if (body.success !== true) {
    result = { ok: false, reason: `rejected: ${(body['error-codes'] ?? []).join(', ') || 'unknown'}` };
  } else if (TEST_SECRET.test(secret)) {
    // Test secrets report no action and a fixed hostname, so check that it
    // really was a test-key result instead.
    result = body.metadata?.result_with_testing_key === true && body.hostname === TEST_HOSTNAME
      ? { ok: true, mode }
      : { ok: false, reason: 'unexpected answer for a test secret' };
  } else if (body.action !== input.action) {
    result = { ok: false, reason: `action '${body.action}' is not '${input.action}'` };
  } else if (body.hostname !== config.expectedHostname) {
    result = { ok: false, reason: `hostname '${body.hostname}' is not '${config.expectedHostname}'` };
  } else {
    result = { ok: true, mode };
  }

  if (mode === 'automation') log(`turnstile automation: action ${input.action} → ${result.ok ? 'pass' : 'fail'}`);
  return result;
}

// Express middleware. The token is `turnstileToken` in the JSON body; the FE
// forwards the browser IP as x-client-ip (the BE is never public, so the FE is
// the only one who can set it). `automationUser` looks up the user the request
// acts for, e.g. by the submitted email; it's only consulted with the header.
export const verifyTurnstile = (
  action: TurnstileAction,
  automationUser: (req: Request) => Promise<{ allowAutomation: boolean } | undefined> = async () => undefined,
) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const config = getConfig();
      const header = req.headers['x-automation-key'];
      const automationKey = typeof header === 'string' ? header : undefined;
      const clientIp = req.headers['x-client-ip'];
      const result = await checkTurnstile(
        {
          token: typeof req.body?.turnstileToken === 'string' ? req.body.turnstileToken : undefined,
          action,
          remoteIp: typeof clientIp === 'string' ? clientIp : undefined,
          automationKey,
          automationUser: automationKey !== undefined && config.automation ? await automationUser(req) : undefined,
        },
        { config: { ...config.turnstile, automation: config.automation }, fetch, log: (m) => console.warn(m) },
      );
      if (!result.ok) return next(new AuthError('Bot check failed. Please try again.'));
      next();
    } catch (error) {
      next(error);
    }
  };
