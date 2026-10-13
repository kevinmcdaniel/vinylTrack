// health.ts - whether the mailer can actually send (#62). In gmail mode a
// token refresh runs at start, then every intervalMs while healthy and every
// retryMs while not, so a brief Google blip during a deploy clears well within
// deploy.sh's health window instead of lasting a full interval. A revoked
// grant (or any failure) makes /health 503, which blocks deploys and feeds
// monitoring. Log mode can't fail to send, so it's always healthy.
import type { MailerMode } from './config.js';
import { TokenRevokedError } from './gmail.js';

export function createHealthMonitor({
  mode, checkToken, intervalMs, retryMs = 30_000, log,
}: {
  mode: MailerMode;
  checkToken: () => Promise<void>;
  intervalMs: number;
  retryMs?: number;
  log: (...parts: unknown[]) => void;
}) {
  let healthy = mode === 'log';
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  async function check() {
    try {
      await checkToken();
      if (!healthy) log('health', 'gmail token ok');
      healthy = true;
    } catch (error) {
      healthy = false;
      if (error instanceof TokenRevokedError) log('health', 'gmail token revoked or expired: re-authorize (scripts/authorize.ts)');
      else log('health', 'gmail token check failed', error instanceof Error ? error.message : String(error));
    }
  }

  function schedule() {
    if (stopped) return;
    timer = setTimeout(async () => {
      await check();
      schedule();
    }, healthy ? intervalMs : retryMs);
    timer.unref?.();
  }

  return {
    isHealthy: () => healthy,
    async start() {
      if (mode === 'log') return;
      await check();
      schedule();
    },
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
