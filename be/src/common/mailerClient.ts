// mailerClient.ts - the BE is the mailer's only caller (#62, #74).
import { getConfig } from '../config.js';

export type MailerResult = 'sent' | 'rate-limited' | 'rejected' | 'failed';

// Never throws: the caller maps the result to a response.
export async function sendMagicLink(to: string, url: string): Promise<MailerResult> {
  const mailer = getConfig().mailer;
  if (!mailer) return 'failed';
  try {
    const res = await fetch(`${mailer.url}/magic-link`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${mailer.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ to, url }),
      // A hung mailer must not hang sign-in.
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return 'sent';
    if (res.status === 429) return 'rate-limited';
    if (res.status === 406) return 'rejected';
    return 'failed';
  } catch {
    return 'failed';
  }
}
