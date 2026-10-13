// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MagicLinkError } from '@/lib/magicLink';

// The email form's server action (#74): which error code a failed send becomes.
const signIn = vi.fn();
vi.mock('@/auth', () => ({ signIn: (...args: unknown[]) => signIn(...args), TURNSTILE_COOKIE: 'vt_turnstile' }));
vi.mock('next/headers', () => ({ cookies: async () => ({ set: vi.fn() }) }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT ${url}`); }),
}));

const { signInWithEmail } = await import('./actions');
const form = (email = 'a@example.com') => { const f = new FormData(); f.set('email', email); f.set('turnstileToken', 'tok'); return f; };

describe('signInWithEmail', () => {
  beforeEach(() => { signIn.mockReset(); });

  it('asks Auth.js for a link, passing the Turnstile token along', async () => {
    signIn.mockRejectedValue(new Error('REDIRECT /sign-in/check-email'));
    await expect(signInWithEmail(form())).rejects.toThrow('REDIRECT /sign-in/check-email');
    expect(signIn).toHaveBeenCalledWith('email', { email: 'a@example.com', turnstileToken: 'tok', redirectTo: '/' });
  });

  it.each([
    ['rate-limited', 'email-rate-limited'],
    ['failed', 'email-failed'],
    ['refused', 'email-refused'],
  ] as const)('turns a %s send into ?error=%s', async (reason, code) => {
    signIn.mockRejectedValue(new MagicLinkError(reason));
    await expect(signInWithEmail(form())).rejects.toThrow(`REDIRECT /sign-in?error=${code}`);
  });

  it('lets anything else propagate (Next\'s redirect, a broken BE)', async () => {
    signIn.mockRejectedValue(new Error('boom'));
    await expect(signInWithEmail(form())).rejects.toThrow('boom');
  });
});
