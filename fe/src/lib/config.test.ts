import { describe, it, expect } from 'vitest';
import { ConfigError, loadConfig, type Env } from './config';

// Pure tests: env and file reads are injected (#65, #73).
const files = (map: Record<string, string>) => (p: string) => {
  if (p in map) return map[p]!;
  throw Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' });
};
const noFiles = files({});
const SECRET = 's'.repeat(32);
const TEST_SITE_KEY = '1x00000000000000000000AA'; // Cloudflare always-pass site key

const base: Env = {
  APP_ENV: 'development',
  BE_URL: 'http://vinyl.be',
  BE_PORT_INT: '3000',
  PUBLIC_HOSTNAME: 'localhost',
  AUTH_SECRET: SECRET,
  INTERNAL_API_SECRET: SECRET,
  TURNSTILE_SITE_KEY: TEST_SITE_KEY,
};

const problemsOf = (fn: () => unknown): string[] => {
  try {
    fn();
  } catch (error) {
    if (error instanceof ConfigError) return error.problems;
    throw error;
  }
  throw new Error('expected a ConfigError');
};

describe('loadConfig', () => {
  it('builds the BE API base URL from BE_URL and BE_PORT_INT', () => {
    expect(loadConfig(base, noFiles).apiBaseUrl).toBe('http://vinyl.be:3000/api');
  });

  it('reports VINYLTRACK_VERSION, and "dev" when it is unset outside production', () => {
    expect(loadConfig({ ...base, VINYLTRACK_VERSION: 'v1.2.3' }, noFiles).version).toBe('v1.2.3');
    expect(loadConfig(base, noFiles).version).toBe('dev');
  });

  it('reports every missing value at once', () => {
    const problems = problemsOf(() => loadConfig({}, noFiles));
    for (const name of ['APP_ENV', 'BE_URL', 'BE_PORT_INT', 'PUBLIC_HOSTNAME', 'AUTH_SECRET_FILE', 'INTERNAL_API_SECRET_FILE', 'TURNSTILE_SITE_KEY']) {
      expect(problems.some((p) => p.includes(name)), name).toBe(true);
    }
  });

  it('rejects a non-numeric BE_PORT_INT and an unknown APP_ENV', () => {
    expect(problemsOf(() => loadConfig({ ...base, BE_PORT_INT: 'abc' }, noFiles))).toEqual([expect.stringContaining('BE_PORT_INT')]);
    expect(problemsOf(() => loadConfig({ ...base, APP_ENV: 'prod' }, noFiles))).toContainEqual(expect.stringContaining('APP_ENV'));
  });

  it('reads the auth and internal API secrets, each at least 32 characters', () => {
    const config = loadConfig(base, noFiles);
    expect(config.authSecret).toBe(SECRET);
    expect(config.internalApiSecret).toBe(SECRET);
    expect(problemsOf(() => loadConfig({ ...base, AUTH_SECRET: 'short' }, noFiles))).toEqual([expect.stringContaining('auth_secret')]);
  });

  it('reads secrets from files too, trimming the trailing newline', () => {
    const { AUTH_SECRET: _a, ...rest } = base;
    const config = loadConfig({ ...rest, AUTH_SECRET_FILE: '/run/secrets/auth_secret' }, files({ '/run/secrets/auth_secret': `${SECRET}\n` }));
    expect(config.authSecret).toBe(SECRET);
  });

  it('carries the public hostname and the Turnstile site key', () => {
    const config = loadConfig(base, noFiles);
    expect(config.publicHostname).toBe('localhost');
    expect(config.turnstile).toEqual({ siteKey: TEST_SITE_KEY });
  });

  it('leaves Google off in development unless both its settings are set', () => {
    expect(loadConfig(base, noFiles).google).toBeUndefined();
    const config = loadConfig({ ...base, GOOGLE_OAUTH_CLIENT_ID: 'id.apps.googleusercontent.com', GOOGLE_OAUTH_CLIENT_SECRET: 'gsecret' }, noFiles);
    expect(config.google).toEqual({ clientId: 'id.apps.googleusercontent.com', clientSecret: 'gsecret' });
    expect(problemsOf(() => loadConfig({ ...base, GOOGLE_OAUTH_CLIENT_ID: 'id' }, noFiles))).toEqual([expect.stringContaining('together')]);
  });

  it('offers the dev sign-in in development and test', () => {
    expect(loadConfig(base, noFiles).devSignIn).toBe(true);
    expect(loadConfig({ ...base, APP_ENV: 'test' }, noFiles).devSignIn).toBe(true);
  });

  it('enables automation only with both the key and the test site key', () => {
    expect(loadConfig(base, noFiles).automation).toBeUndefined();
    const config = loadConfig({ ...base, AUTOMATION_KEY: 'auto', TURNSTILE_TEST_SITE_KEY: TEST_SITE_KEY }, noFiles);
    expect(config.automation).toEqual({ key: 'auto', testSiteKey: TEST_SITE_KEY });
    expect(problemsOf(() => loadConfig({ ...base, AUTOMATION_KEY: 'auto' }, noFiles))).toEqual([expect.stringContaining('together')]);
  });

  it('rejects AUTH_BOOTSTRAP_OWNER_EMAIL anywhere: the FE identifies callers by session now', () => {
    expect(problemsOf(() => loadConfig({ ...base, AUTH_BOOTSTRAP_OWNER_EMAIL: 'kevin@example.com' }, noFiles)))
      .toEqual([expect.stringContaining('AUTH_BOOTSTRAP_OWNER_EMAIL')]);
  });

  describe('APP_ENV=production', () => {
    const { AUTH_SECRET: _a, INTERNAL_API_SECRET: _i, ...noSecrets } = base;
    const prod: Env = {
      ...noSecrets,
      APP_ENV: 'production',
      VINYLTRACK_VERSION: 'v1.2.3',
      PUBLIC_HOSTNAME: 'vinyl.example.org',
      TURNSTILE_SITE_KEY: '0x4AAAAAAArealsitekey',
      GOOGLE_OAUTH_CLIENT_ID: 'id.apps.googleusercontent.com',
      AUTH_SECRET_FILE: '/run/secrets/auth_secret',
      INTERNAL_API_SECRET_FILE: '/run/secrets/internal_api_secret',
      GOOGLE_OAUTH_CLIENT_SECRET_FILE: '/run/secrets/google_oauth_client_secret',
    };
    const secretFiles = {
      '/run/secrets/auth_secret': SECRET,
      '/run/secrets/internal_api_secret': SECRET,
      '/run/secrets/google_oauth_client_secret': 'gsecret',
    };
    const prodFiles = files(secretFiles);

    it('starts with Google, no dev sign-in, no automation', () => {
      const config = loadConfig(prod, prodFiles);
      expect(config.appEnv).toBe('production');
      expect(config.google).toEqual({ clientId: 'id.apps.googleusercontent.com', clientSecret: 'gsecret' });
      expect(config.devSignIn).toBe(false);
      expect(config.automation).toBeUndefined();
    });

    it('requires Google and VINYLTRACK_VERSION', () => {
      const { GOOGLE_OAUTH_CLIENT_ID: _g, VINYLTRACK_VERSION: _v, ...missing } = prod;
      const problems = problemsOf(() => loadConfig(missing, prodFiles));
      expect(problems.join('\n')).toMatch(/GOOGLE_OAUTH_CLIENT_ID/);
      expect(problems.join('\n')).toMatch(/VINYLTRACK_VERSION/);
    });

    it('refuses plain-variable secrets', () => {
      const { AUTH_SECRET_FILE: _f, ...noFile } = prod;
      expect(problemsOf(() => loadConfig({ ...noFile, AUTH_SECRET: SECRET }, prodFiles))).toEqual([expect.stringContaining('AUTH_SECRET_FILE')]);
    });

    it('refuses the automation key, the test site key, and a Cloudflare test key as the site key', () => {
      for (const extra of [{ AUTOMATION_KEY: 'k' }, { TURNSTILE_TEST_SITE_KEY: TEST_SITE_KEY }, { TURNSTILE_SITE_KEY: '2x00000000000000000000AB' }]) {
        const problems = problemsOf(() => loadConfig({ ...prod, ...extra }, prodFiles));
        expect(problems.length, JSON.stringify(extra)).toBeGreaterThan(0);
      }
    });

    it('judges an unknown APP_ENV by production rules', () => {
      const problems = problemsOf(() => loadConfig({ ...base, APP_ENV: 'prod', AUTOMATION_KEY: 'k', TURNSTILE_TEST_SITE_KEY: TEST_SITE_KEY }, noFiles));
      expect(problems.join('\n')).toMatch(/AUTOMATION_KEY/);
    });
  });
});
