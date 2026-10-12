// server.ts - wires config, the sender, the rate limit and health together (#62).
import { createApp, type Sender } from './app.js';
import { getConfig } from './config.js';
import { createGmailSender } from './gmail.js';
import { createHealthMonitor } from './health.js';
import { createRateLimiter } from './rateLimit.js';
import { toGmailRaw } from './template.js';

const config = getConfig();
const log = (...parts: unknown[]) => console.log('mailer:', ...parts);

let sender: Sender;
let checkToken: () => Promise<void> = async () => {};
if (config.mode === 'gmail') {
  const gmail = createGmailSender(config.gmail!);
  sender = { send: (message) => gmail.send(toGmailRaw(message)) };
  checkToken = () => gmail.checkToken();
} else {
  // Log mode (development/test only; config refuses it in production): print
  // the link so local sign-in works without Google credentials.
  sender = { send: async (m) => { console.log(`mailer: [log mode] sign-in link for ${m.to}: ${m.url}`); } };
}

const health = createHealthMonitor({ mode: config.mode, checkToken, intervalMs: 15 * 60_000, log });
await health.start();

const app = createApp({
  config,
  sender,
  limiter: createRateLimiter({ limit: 3, windowMs: 15 * 60_000 }),
  // Bounds a leaked mailer_token or a compromised be: the family mailbox sends
  // at most this many sign-in emails per 15 minutes, to anyone.
  globalLimiter: createRateLimiter({ limit: 30, windowMs: 15 * 60_000 }),
  log,
  isHealthy: health.isHealthy,
});

app.listen(config.port, () => log(`listening on ${config.port} (${config.mode} mode, ${config.version})`));
