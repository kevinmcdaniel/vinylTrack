import 'server-only';
import { AuthError } from 'next-auth';
import { servicePost } from './serviceApi';

export type MagicLinkFailure = 'rate-limited' | 'refused' | 'failed';

/**
 * Why a sign-in email didn't go out. An AuthError, so Auth.js rethrows it to
 * the sign-in server action, which picks the message to show.
 */
export class MagicLinkError extends AuthError {
  static type = 'EmailSignInError';
  constructor(readonly reason: MagicLinkFailure) {
    super(`Sign-in email not sent: ${reason}`);
  }
}

const failure = (status: number): MagicLinkFailure =>
  status === 429 ? 'rate-limited' : status === 401 || status === 406 ? 'refused' : 'failed';

/**
 * The email provider's sendVerificationRequest (#74). The BE checks Turnstile
 * and asks the mailer to send. Auth.js passes the sign-in form fields (as
 * JSON) and the browser's own headers in `request`, so the Turnstile token,
 * client IP and automation key ride along without a cookie.
 */
export async function sendMagicLink({ identifier, url, request }: { identifier: string; url: string; request: Request }) {
  const body = (await request.json().catch(() => ({}))) as { turnstileToken?: unknown };
  const turnstileToken = typeof body.turnstileToken === 'string' ? body.turnstileToken : undefined;
  let res: Response;
  try {
    res = await servicePost('/auth/magic-link', { email: identifier, url, turnstileToken }, {
      clientIp: request.headers.get('cf-connecting-ip') ?? undefined,
      automationKey: request.headers.get('x-automation-key') ?? undefined,
    });
  } catch (error) {
    // Never the address or the link: one is personal, the other a login credential.
    console.warn('magic-link', 'BE unreachable', error instanceof Error ? error.name : 'error');
    throw new MagicLinkError('failed');
  }
  if (res.ok) return;
  console.warn('magic-link', 'BE answered', res.status);
  throw new MagicLinkError(failure(res.status));
}
