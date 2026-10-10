import { vi } from 'vitest';

// A complete development config for tests that go through getConfig() (#73).
export const TEST_INTERNAL_SECRET = 'test-internal-api-secret-0123456789abcdef';

export function stubAppEnv(over: Record<string, string> = {}) {
  const env: Record<string, string> = {
    APP_ENV: 'development',
    BE_URL: 'http://vinyl.be',
    BE_PORT_INT: '3000',
    PUBLIC_HOSTNAME: 'localhost',
    AUTH_SECRET: 'test-auth-secret-0123456789abcdef0123',
    INTERNAL_API_SECRET: TEST_INTERNAL_SECRET,
    TURNSTILE_SITE_KEY: '1x00000000000000000000AA',
    ...over,
  };
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
}
