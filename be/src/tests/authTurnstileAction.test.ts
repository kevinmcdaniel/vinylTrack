import { describe, it, expect, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

// Which Turnstile action each auth route checks (#74). The sign-in page shows
// one widget for every method, so sending a magic link checks 'sign-in' too.
const { actions } = vi.hoisted(() => ({ actions: [] as string[] }));
vi.mock('../common/turnstile.js', () => ({
  verifyTurnstile: (action: string) => {
    actions.push(action);
    return (_req: Request, _res: Response, next: NextFunction) => next();
  },
}));

describe('auth routes: Turnstile actions', () => {
  it("checks 'sign-in' for sign-in and magic links, 'request-access' for asking again", async () => {
    await import('../route/auth.js');
    expect(actions).not.toContain('magic-link');
    expect(new Set(actions)).toEqual(new Set(['sign-in', 'request-access']));
  });
});
