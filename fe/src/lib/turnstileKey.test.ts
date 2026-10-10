// @vitest-environment node
import { describe, it, expect, afterEach, vi } from 'vitest';
import { turnstileSiteKey } from './turnstileKey';
import { stubAppEnv } from '@/tests/env';

// Automation mode (#11): a request carrying the right x-automation-key gets
// Cloudflare's test site key; everyone else gets the regular one.
describe('turnstileSiteKey', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('uses the regular site key by default', () => {
    stubAppEnv({ TURNSTILE_SITE_KEY: 'regular-key' });
    expect(turnstileSiteKey(new Headers())).toBe('regular-key');
  });

  it('uses the test site key only for the right automation key', () => {
    stubAppEnv({ TURNSTILE_SITE_KEY: 'regular-key', AUTOMATION_KEY: 'auto', TURNSTILE_TEST_SITE_KEY: '1x00000000000000000000AA' });
    expect(turnstileSiteKey(new Headers({ 'x-automation-key': 'auto' }))).toBe('1x00000000000000000000AA');
    expect(turnstileSiteKey(new Headers({ 'x-automation-key': 'wrong' }))).toBe('regular-key');
  });

  it('ignores the header when automation is not configured', () => {
    stubAppEnv({ TURNSTILE_SITE_KEY: 'regular-key' });
    expect(turnstileSiteKey(new Headers({ 'x-automation-key': 'auto' }))).toBe('regular-key');
  });
});
