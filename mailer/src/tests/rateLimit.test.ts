import { describe, it, expect } from 'vitest';
import { createRateLimiter } from '../rateLimit.js';

describe('createRateLimiter', () => {
  it('allows `limit` per key per window, then refuses until the window moves on', () => {
    let now = 0;
    const limiter = createRateLimiter({ limit: 3, windowMs: 15 * 60_000, now: () => now });
    expect([limiter.allow('a'), limiter.allow('a'), limiter.allow('a'), limiter.allow('a')]).toEqual([true, true, true, false]);
    expect(limiter.allow('b')).toBe(true);
    now = 15 * 60_000 + 1;
    expect(limiter.allow('a')).toBe(true);
  });
});
