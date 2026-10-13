// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { User, Account } from 'next-auth';
import { stubAppEnv } from '@/tests/env';

// Auth.js config (#73, #74): which providers exist and what the signIn callback asks the BE.
const backendSignIn = vi.fn();
vi.mock('@/lib/backendSignIn', () => ({ backendSignIn: (...args: unknown[]) => backendSignIn(...args) }));
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'cf-connecting-ip': '203.0.113.9' }),
  cookies: async () => ({ get: () => undefined, delete: () => {} }),
}));

const { authConfig } = await import('./auth');
const emailAccount: Account = { provider: 'email', type: 'email', providerAccountId: 'a@example.com' };

describe('authConfig', () => {
  beforeEach(() => stubAppEnv());
  afterEach(() => { vi.unstubAllEnvs(); backendSignIn.mockReset(); });

  it('offers magic links: a 15-minute email provider, a BE-backed adapter, its own check-email page', () => {
    const config = authConfig();
    const email = config.providers.find((p) => typeof p !== 'function' && p.id === 'email');
    expect(email).toMatchObject({ type: 'email', maxAge: 15 * 60 });
    expect(config.adapter?.createVerificationToken).toBeTypeOf('function');
    expect(config.pages?.verifyRequest).toBe('/sign-in/check-email');
  });

  it('lets the link be sent without asking the BE: Turnstile runs when the BE is asked to send', async () => {
    const user: User = { id: 'random', email: 'a@example.com' };
    await expect(authConfig().callbacks!.signIn!({ user, account: emailAccount, email: { verificationRequest: true } })).resolves.toBe(true);
    expect(backendSignIn).not.toHaveBeenCalled();
  });

  it('signs in through the BE when the link is followed, and carries the BE user id', async () => {
    backendSignIn.mockResolvedValue({ id: 'be-user-1', status: 'pending', isAdmin: false });
    const user: User = { id: 'random', email: 'a@example.com' };
    await expect(authConfig().callbacks!.signIn!({ user, account: emailAccount })).resolves.toBe(true);
    expect(backendSignIn).toHaveBeenCalledWith({ provider: 'email', email: 'a@example.com' }, { clientIp: '203.0.113.9' });
    expect(user.id).toBe('be-user-1');
  });

  it('refuses a followed link the BE turns down', async () => {
    backendSignIn.mockResolvedValue(null);
    const user: User = { id: 'random', email: 'a@example.com' };
    await expect(authConfig().callbacks!.signIn!({ user, account: emailAccount })).resolves.toBe(false);
    expect(user.id).toBe('random');
  });
});
