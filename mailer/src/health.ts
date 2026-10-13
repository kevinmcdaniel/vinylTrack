// health.ts - whether the mailer can actually send (#62). In gmail mode a
// token refresh runs at start and every intervalMs; a revoked grant (or any
// failure) makes /health 503, which blocks deploys (deploy.sh) and feeds
// monitoring. Log mode can't fail to send, so it's always healthy.
import type { MailerMode } from './config.js';
import { TokenRevokedError } from './gmail.js';

export function createHealthMonitor({
  mode, checkToken, intervalMs, log,
}: { mode: MailerMode; checkToken: () => Promise<void>; intervalMs: number; log: (...parts: unknown[]) => void }) {
  let healthy = mode === 'log';
  let timer: ReturnType<typeof setInterval> | undefined;

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

  return {
    isHealthy: () => healthy,
    async start() {
      if (mode === 'log') return;
      await check();
      timer = setInterval(() => { void check(); }, intervalMs);
      timer.unref?.();
    },
    stop() {
      if (timer) clearInterval(timer);
    },
  };
}
