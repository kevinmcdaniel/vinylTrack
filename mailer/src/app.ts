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

export function createApp({ config, sender, limiter, log, isHealthy }: Deps) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '4kb' }));

  const requireToken = (req: Request, res: Response, next: NextFunction) => {
    const match = /^Bearer (.+)$/.exec(req.headers.authorization ?? '');
    if (!match || !sameToken(match[1]!, config.mailerToken)) return reply(res, 401, 'Unauthorized.');
    next();
  };

  app.get('/health', (_req, res) => {
    const data = { status: isHealthy() ? 'ok' : 'unhealthy', version: config.version, mode: config.mode };
    res.status(isHealthy() ? 200 : 503).json({ data, message: data.status, status: isHealthy() ? 200 : 503 });
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
    if (!limiter.allow(to.toLowerCase())) {
      log('magic-link', domain, 'rate-limited');
      return reply(res, 429, 'Too many sign-in emails to this address; try again later.', {});
    }
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
  return app;
}
