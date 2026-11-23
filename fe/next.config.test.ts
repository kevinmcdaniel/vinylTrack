// @vitest-environment node
import { describe, it, expect } from 'vitest';
import nextConfig from './next.config';

describe('next.config', () => {
  // #129 item 3: nothing uses next/image, and proxy.ts lets /_next/image
  // through unauthenticated, so the optimizer stays off.
  it('turns the image optimizer off', () => {
    expect(nextConfig.images?.unoptimized).toBe(true);
  });

  it('keeps the standalone output the production image ships', () => {
    expect(nextConfig.output).toBe('standalone');
  });
});
