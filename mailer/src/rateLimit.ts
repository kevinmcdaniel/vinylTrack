// rateLimit.ts - in-memory sliding window per key (#62). One mailer instance,
// so memory is enough; a restart resets it, which is fine at family scale.
// Keys whose hits have all expired are swept (at most once per window), so a
// stream of distinct keys can't grow the map without bound.
export function createRateLimiter({ limit, windowMs, now = Date.now }: { limit: number; windowMs: number; now?: () => number }) {
  const hits = new Map<string, number[]>();
  let lastSweep = now();

  const sweep = (t: number) => {
    for (const [key, times] of hits) {
      if (times.every((h) => t - h >= windowMs)) hits.delete(key);
    }
    lastSweep = t;
  };

  return {
    allow(key: string): boolean {
      const t = now();
      if (t - lastSweep >= windowMs) sweep(t);
      const recent = (hits.get(key) ?? []).filter((h) => t - h < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(t);
      hits.set(key, recent);
      return true;
    },
    size: () => hits.size,
  };
}
export type RateLimiter = ReturnType<typeof createRateLimiter>;
