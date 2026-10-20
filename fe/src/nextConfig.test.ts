// @vitest-environment node
import { describe, it, expect } from 'vitest';
import nextConfig from '../next.config';

// #9: a stale service worker would pin every phone to an old release, so the
// browser must always ask for /sw.js fresh.
describe('next.config headers', () => {
  it('serves /sw.js uncached, as JavaScript, for the whole site', async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const sw = rules.find((r) => r.source === '/sw.js');
    expect(sw?.headers).toEqual(expect.arrayContaining([
      { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
      { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
      { key: 'Service-Worker-Allowed', value: '/' },
    ]));
  });
});
