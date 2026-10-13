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
