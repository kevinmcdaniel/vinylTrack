// mailerClient.ts - the BE is the mailer's only caller (#62, #74).
import { getConfig } from '../config.js';

export type MailerResult = 'sent' | 'rate-limited' | 'rejected' | 'failed';

// Outlasts the mailer's worst case: token exchange + send, both repeated on a
// 401 retry, 10s each (mailer/src/gmail.ts). Giving up sooner would 502 a send
// that still lands, and the retry spends the recipient's 3-per-15-min allowance.
export const MAILER_TIMEOUT_MS = 45_000;

// Never the address or the link: one is personal, the other a login credential.
const logFailure = (detail: string | number) => console.warn('mailer', 'magic-link', detail);

// Never throws: the caller maps the result to a response.
export async function sendMagicLink(to: string, url: string): Promise<MailerResult> {
  const mailer = getConfig().mailer;
  if (!mailer) {
    logFailure('not configured');
    return 'failed';
  }
  try {
    const res = await fetch(`${mailer.url}/magic-link`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${mailer.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ to, url }),
      // A hung mailer must not hang sign-in.
      signal: AbortSignal.timeout(MAILER_TIMEOUT_MS),
    });
    if (res.ok) return 'sent';
    logFailure(res.status);
    if (res.status === 429) return 'rate-limited';
    if (res.status === 406) return 'rejected';
    return 'failed';
  } catch (error) {
    // TimeoutError vs TypeError (unreachable) is the whole diagnosis.
    logFailure(error instanceof Error ? error.name : 'error');
    return 'failed';
  }
}

export type MailerHealth =
  | { status: 'up' | 'down'; detail?: string; version?: string; mode?: string }
  | { status: 'not configured' };

// Short, unlike a send: the admin page waits on it (#90).
export const MAILER_HEALTH_TIMEOUT_MS = 3_000;

const logHealth = (detail: string | number) => console.warn('admin', 'health', 'mailer', detail);

// Never throws. A 503 still carries the mailer's version and mode, so a
// revoked Gmail grant reads as "v0.9.0, down" rather than "unreachable".
export async function checkMailerHealth(): Promise<MailerHealth> {
  const mailer = getConfig().mailer;
  if (!mailer) return { status: 'not configured' };
  try {
    const res = await fetch(`${mailer.url}/health`, { signal: AbortSignal.timeout(MAILER_HEALTH_TIMEOUT_MS) });
    const data = (await res.json().catch(() => null))?.data;
    const reported = {
      ...(typeof data?.version === 'string' && { version: data.version }),
      ...(typeof data?.mode === 'string' && { mode: data.mode }),
    };
    if (res.ok) return { status: 'up', ...reported };
    logHealth(res.status);
    return { status: 'down', detail: typeof data?.status === 'string' ? data.status : String(res.status), ...reported };
  } catch (error) {
    const name = error instanceof Error ? error.name : 'error';
    logHealth(name);
    return { status: 'down', detail: name };
  }
}
