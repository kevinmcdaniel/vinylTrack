// app.ts - the mailer's HTTP API (#62). Internal only: no published port,
// reachable from `be` alone (mailnet), and every call needs the bearer token.
import { createHash, timingSafeEqual } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import type { Config } from './config.js';
import type { RateLimiter } from './rateLimit.js';
import { renderMagicLinkEmail, type RenderedEmail } from './template.js';

export type Sender = { send: (message: RenderedEmail) => Promise<void> };

type Deps = {
  config: Config;
  sender: Sender;
  limiter: RateLimiter;
  globalLimiter: RateLimiter;
  log: (...parts: unknown[]) => void;
  isHealthy: () => boolean;
};

const EMAIL = /^[^\s@<>,;:"()[\]\\]+@[^\s@<>,;:"()[\]\\]+\.[^\s@<>,;:"()[\]\\]+$/;

const reply = (res: Response, status: number, message: string, data: unknown = null) =>
  res.status(status).json({ data, message, status });

// Hash both sides so timingSafeEqual sees equal lengths whatever was sent.
const sameToken = (a: string, b: string) =>
  timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());

// The link must be on the app's own origin: same scheme, host and port.
// URL parsing (not string prefixes) defeats tricks like
// https://vinyl.example.org.evil.com or https://vinyl.example.org@evil.com.
function linkAllowed(url: string, origin: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.origin === origin && parsed.username === '' && parsed.password === '';
  } catch {
    return false;
  }
}

// The inbox an address actually reaches, for rate limiting: lowercase, no
// +tag, and no dots for Gmail (which ignores them), so a+1@ / a.b@ variants
// can't multiply one person's allowance.
export function recipientKey(address: string): string {
  const [local = '', domain = ''] = address.toLowerCase().split('@');
  let base = local.split('+')[0]!;
  const gmail = domain === 'gmail.com' || domain === 'googlemail.com';
  if (gmail) base = base.replace(/\./g, '');
  return `${base}@${gmail ? 'gmail.com' : domain}`;
}

export function createApp({ config, sender, limiter, globalLimiter, log, isHealthy }: Deps) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '4kb' }));

  const requireToken = (req: Request, res: Response, next: NextFunction) => {
    const match = /^Bearer (.+)$/.exec(req.headers.authorization ?? '');
    if (!match || !sameToken(match[1]!, config.mailerToken)) return reply(res, 401, 'Unauthorized.');
    next();
  };

  app.get('/health', (_req, res) => {
    const healthy = isHealthy();
    const data = { status: healthy ? 'ok' : 'unhealthy', version: config.version, mode: config.mode };
    return reply(res, healthy ? 200 : 503, data.status, data);
  });

  // Fixed template only: the caller chooses the recipient and the link, nothing else.
  app.post('/magic-link', requireToken, async (req, res) => {
    const body = req.body ?? {};
    const unexpected = Object.keys(body).filter((k) => k !== 'to' && k !== 'url');
    if (unexpected.length > 0) return reply(res, 406, `Unexpected field(s): ${unexpected.join(', ')}.`, {});
    const { to, url } = body as { to?: unknown; url?: unknown };
    if (typeof to !== 'string' || !EMAIL.test(to)) return reply(res, 406, 'to must be a single email address.', {});
    if (typeof url !== 'string' || !linkAllowed(url, config.linkOrigin)) return reply(res, 406, 'url is not a vinylTrack link.', {});

    // Log the domain only: the address is personal and the link is a login credential.
    const domain = to.split('@')[1]!.toLowerCase();
    // Check both limits before spending either, so a refusal costs nothing.
    const key = recipientKey(to);
    if (!limiter.check(key)) {
      log('magic-link', domain, 'rate-limited');
      return reply(res, 429, 'Too many sign-in emails to this address; try again later.', {});
    }
    if (!globalLimiter.check('all')) {
      log('magic-link', domain, 'global-limit');
      return reply(res, 429, 'Too many sign-in emails right now; try again later.', {});
    }
    limiter.allow(key);
    globalLimiter.allow('all');
    try {
      await sender.send(renderMagicLinkEmail({ from: config.from, to, url }));
      log('magic-link', domain, 'sent');
      return reply(res, 200, 'Sent', { sent: true });
    } catch (error) {
      log('magic-link', domain, 'failed', error instanceof Error ? error.name : 'error');
      return reply(res, 502, 'Could not send the email.', {});
    }
  });

  app.use((_req, res) => reply(res, 404, 'Not found.'));

  // Last resort, so nothing ever reaches Express's default handler: that one
  // answers in HTML and includes a stack trace unless NODE_ENV=production.
  // Body-parser errors (bad JSON 400, too large 413) keep their status.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = typeof (err as { status?: unknown }).status === 'number' ? (err as { status: number }).status : 500;
    if (status >= 500) log('error', err instanceof Error ? err.name : 'error');
    const message = status === 400 ? 'Malformed request body.' : status === 413 ? 'Request body too large.' : status >= 500 ? 'Internal error.' : 'Bad request.';
    return reply(res, status >= 400 && status < 600 ? status : 500, message);
  });
  return app;
}
