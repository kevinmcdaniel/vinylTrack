import { describe, it, expect } from 'vitest';
import { ConfigError, loadConfig, loadDatabaseConfig, readSecret, type Env } from '../config.js';

// Pure tests: env and file reads are injected, so nothing here touches
// process.env or the filesystem (#65).

const files = (map: Record<string, string>) => (path: string) => {
  if (path in map) return map[path]!;
  throw Object.assign(new Error(`ENOENT: no such file, open '${path}'`), { code: 'ENOENT' });
};
const noFiles = files({});

const INTERNAL = 'i'.repeat(32);
// Cloudflare's always-pass test secret: fine outside production, refused in it.
const TEST_PASS_SECRET = '1x0000000000000000000000000000000AA';

const base: Env = {
  APP_ENV: 'development',
  DB_HOST: 'vinyl.db',
  DB_PORT_INT: '5432',
  DB_VINYLTRACK_NAME: 'vinyltrack',
  DB_VINYLTRACK_USER: 'vinyltrack',
  PUBLIC_HOSTNAME: 'localhost',
  INTERNAL_API_SECRET: INTERNAL,
  TURNSTILE_SECRET_KEY: TEST_PASS_SECRET,
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

// ── readSecret ───────────────────────────────────────────────────────────

describe('readSecret', () => {
  it('reads the file named by <NAME>_FILE', () => {
    const env = { DB_PASSWORD_FILE: '/run/secrets/db_password' };
    const read = files({ '/run/secrets/db_password': 's3cret' });
    expect(readSecret('db_password', env, read, 'development')).toEqual({ value: 's3cret' });
  });

  it('trims one trailing newline from the file, and only that', () => {
    const env = { DB_PASSWORD_FILE: '/s' };
    expect(readSecret('db_password', env, files({ '/s': ' pw \n' }), 'development')).toEqual({ value: ' pw ' });
    expect(readSecret('db_password', env, files({ '/s': 'pw\r\n' }), 'development')).toEqual({ value: 'pw' });
  });

  it('falls back to the plain <NAME> variable outside production', () => {
    expect(readSecret('db_password', { DB_PASSWORD: 'pw' }, noFiles, 'test')).toEqual({ value: 'pw' });
  });

  it('refuses the plain variable in production', () => {
    const result = readSecret('db_password', { DB_PASSWORD: 'pw' }, noFiles, 'production');
    expect(result).toEqual({ problem: expect.stringContaining('DB_PASSWORD_FILE') });
  });

  it('refuses both forms at once', () => {
    const env = { DB_PASSWORD: 'pw', DB_PASSWORD_FILE: '/s' };
    const result = readSecret('db_password', env, files({ '/s': 'pw' }), 'development');
    expect(result).toEqual({ problem: expect.stringMatching(/DB_PASSWORD_FILE.*DB_PASSWORD|not both/) });
  });

  it('reports a missing secret', () => {
    expect(readSecret('db_password', {}, noFiles, 'development')).toEqual({ problem: expect.stringContaining('DB_PASSWORD_FILE') });
  });

  it('reports an unreadable file with its path', () => {
    const result = readSecret('db_password', { DB_PASSWORD_FILE: '/nope' }, noFiles, 'development');
    expect(result).toEqual({ problem: expect.stringContaining('/nope') });
  });

  it('reports an empty secret', () => {
    const result = readSecret('db_password', { DB_PASSWORD_FILE: '/s' }, files({ '/s': '\n' }), 'development');
    expect(result).toEqual({ problem: expect.stringContaining('empty') });
  });
});

// ── loadConfig ───────────────────────────────────────────────────────────

describe('loadConfig', () => {
  it('builds the database URL from config parts and the db_password secret', () => {
    const config = loadConfig({ ...base, DB_PASSWORD: 'pw' }, noFiles);
    expect(config.databaseUrl).toBe('postgresql://vinyltrack:pw@vinyl.db:5432/vinyltrack?schema=public');
  });

  it('URL-encodes the password, so any character is safe', () => {
    const config = loadConfig({ ...base, DB_PASSWORD: 'p@ss:w/rd#?' }, noFiles);
    expect(config.databaseUrl).toBe('postgresql://vinyltrack:p%40ss%3Aw%2Frd%23%3F@vinyl.db:5432/vinyltrack?schema=public');
  });

  it('defaults PORT to 3000 and reads it when set', () => {
    expect(loadConfig({ ...base, DB_PASSWORD: 'pw' }, noFiles).port).toBe(3000);
    expect(loadConfig({ ...base, DB_PASSWORD: 'pw', PORT: '4100' }, noFiles).port).toBe(4100);
  });

  it('reports VINYLTRACK_VERSION, and "dev" when it is unset outside production', () => {
    expect(loadConfig({ ...base, DB_PASSWORD: 'pw', VINYLTRACK_VERSION: 'v1.2.3' }, noFiles).version).toBe('v1.2.3');
    expect(loadConfig({ ...base, DB_PASSWORD: 'pw' }, noFiles).version).toBe('dev');
  });

  it('requires APP_ENV, and only accepts known values', () => {
    const { APP_ENV: _omit, ...noAppEnv } = base;
    expect(problemsOf(() => loadConfig({ ...noAppEnv, DB_PASSWORD: 'pw' }, noFiles))).toContainEqual(expect.stringContaining('APP_ENV'));
    expect(problemsOf(() => loadConfig({ ...base, APP_ENV: 'prod', DB_PASSWORD: 'pw' }, noFiles))).toContainEqual(expect.stringContaining('APP_ENV'));
  });

  it('judges an unknown APP_ENV by production rules, so a typo cannot loosen them', () => {
    const problems = problemsOf(() => loadConfig({ ...base, APP_ENV: 'prod', DB_PASSWORD: 'pw', AUTOMATION_KEY: 'k', TURNSTILE_TEST_SECRET_KEY: TEST_PASS_SECRET }, noFiles));
    expect(problems).toContainEqual(expect.stringContaining('DB_PASSWORD_FILE'));
    expect(problems).toContainEqual(expect.stringContaining('AUTOMATION_KEY'));
  });

  it('reports every problem at once, not just the first', () => {
    const problems = problemsOf(() => loadConfig({ APP_ENV: 'development', PORT: 'abc' }, noFiles));
    for (const name of ['DB_HOST', 'DB_PORT_INT', 'DB_VINYLTRACK_NAME', 'DB_VINYLTRACK_USER', 'DB_PASSWORD_FILE', 'PORT', 'PUBLIC_HOSTNAME', 'INTERNAL_API_SECRET_FILE', 'TURNSTILE_SECRET_KEY_FILE']) {
      expect(problems.some((p) => p.includes(name))).toBe(true);
    }
    expect(problemsOf(() => loadConfig({ APP_ENV: 'development' }, noFiles)).join('\n')).toMatch(/DB_HOST[\s\S]*DB_PASSWORD_FILE/);
  });

  // ── auth (#73) ──────────────────────────────────────────────────────────

  it('reads the internal API secret, and refuses one shorter than 32 characters', () => {
    expect(loadConfig({ ...base, DB_PASSWORD: 'pw' }, noFiles).internalApiSecret).toBe(INTERNAL);
    expect(problemsOf(() => loadConfig({ ...base, DB_PASSWORD: 'pw', INTERNAL_API_SECRET: 'short' }, noFiles)))
      .toEqual([expect.stringContaining('internal_api_secret')]);
  });

  it('reads the Turnstile secret, and expects tokens issued for PUBLIC_HOSTNAME', () => {
    const { turnstile } = loadConfig({ ...base, DB_PASSWORD: 'pw' }, noFiles);
    expect(turnstile).toEqual({ secretKey: TEST_PASS_SECRET, expectedHostname: 'localhost' });
  });

  it('leaves automation mode off unless both its secrets are set', () => {
    expect(loadConfig({ ...base, DB_PASSWORD: 'pw' }, noFiles).automation).toBeUndefined();
    const config = loadConfig({ ...base, DB_PASSWORD: 'pw', AUTOMATION_KEY: 'auto', TURNSTILE_TEST_SECRET_KEY: TEST_PASS_SECRET }, noFiles);
    expect(config.automation).toEqual({ key: 'auto', testSecretKey: TEST_PASS_SECRET });
    expect(problemsOf(() => loadConfig({ ...base, DB_PASSWORD: 'pw', AUTOMATION_KEY: 'auto' }, noFiles)))
      .toEqual([expect.stringMatching(/TURNSTILE_TEST_SECRET_KEY.*together|together.*TURNSTILE_TEST_SECRET_KEY/)]);
  });

  it('allows the x-user-email dev identity in development and test only', () => {
    expect(loadConfig({ ...base, DB_PASSWORD: 'pw' }, noFiles).devIdentityHeader).toBe(true);
    expect(loadConfig({ ...base, APP_ENV: 'test', DB_PASSWORD: 'pw' }, noFiles).devIdentityHeader).toBe(true);
  });

  it('rejects AUTH_BOOTSTRAP_OWNER_EMAIL anywhere: the fallback identity is gone', () => {
    expect(problemsOf(() => loadConfig({ ...base, DB_PASSWORD: 'pw', AUTH_BOOTSTRAP_OWNER_EMAIL: 'kevin@example.com' }, noFiles)))
      .toEqual([expect.stringContaining('AUTH_BOOTSTRAP_OWNER_EMAIL')]);
  });

  describe('APP_ENV=production', () => {
    const { INTERNAL_API_SECRET: _i, TURNSTILE_SECRET_KEY: _t, ...baseNoSecrets } = base;
    const prod: Env = {
      ...baseNoSecrets,
      APP_ENV: 'production',
      VINYLTRACK_VERSION: 'v1.2.3',
      PUBLIC_HOSTNAME: 'vinyl.example.org',
      DB_PASSWORD_FILE: '/run/secrets/db_password',
      INTERNAL_API_SECRET_FILE: '/run/secrets/internal_api_secret',
      TURNSTILE_SECRET_KEY_FILE: '/run/secrets/turnstile_secret_key',
    };
    const secretFiles: Record<string, string> = {
      '/run/secrets/db_password': 'pw\n',
      '/run/secrets/internal_api_secret': `${INTERNAL}\n`,
      '/run/secrets/turnstile_secret_key': '0x4AAAAAAAreal-looking-secret\n',
    };
    const prodFiles = files(secretFiles);

    it('requires VINYLTRACK_VERSION, so a deployed build always says what it is', () => {
      const { VINYLTRACK_VERSION: _omit, ...noVersion } = prod;
      expect(problemsOf(() => loadConfig(noVersion, prodFiles))).toEqual([expect.stringContaining('VINYLTRACK_VERSION')]);
    });

    it('starts from secret files, with the dev identity header off and no automation', () => {
      const config = loadConfig(prod, prodFiles);
      expect(config.appEnv).toBe('production');
      expect(config.devIdentityHeader).toBe(false);
      expect(config.automation).toBeUndefined();
      expect(config.turnstile.expectedHostname).toBe('vinyl.example.org');
    });

    it('refuses a plain DB_PASSWORD', () => {
      const { DB_PASSWORD_FILE: _omit, ...noFile } = prod;
      const problems = problemsOf(() => loadConfig({ ...noFile, DB_PASSWORD: 'pw' }, prodFiles));
      expect(problems).toEqual([expect.stringContaining('DB_PASSWORD_FILE')]);
    });

    it('refuses the automation key and the Turnstile test secret, as plain variables or files', () => {
      for (const extra of [{ AUTOMATION_KEY: 'k' }, { AUTOMATION_KEY_FILE: '/run/secrets/automation_key' }, { TURNSTILE_TEST_SECRET_KEY: TEST_PASS_SECRET }]) {
        const problems = problemsOf(() => loadConfig({ ...prod, ...extra }, files({ ...secretFiles, '/run/secrets/automation_key': 'k' })));
        expect(problems.length, JSON.stringify(extra)).toBeGreaterThan(0);
        expect(problems.join('\n'), JSON.stringify(extra)).toMatch(/not allowed in production/);
      }
    });

    it("refuses Cloudflare's test Turnstile secrets (1x/2x/3x)", () => {
      for (const secret of ['1x0000000000000000000000000000000AA', '2x0000000000000000000000000000000AA', '3x0000000000000000000000000000000AA']) {
        const problems = problemsOf(() => loadConfig(prod, files({ ...secretFiles, '/run/secrets/turnstile_secret_key': secret })));
        expect(problems).toEqual([expect.stringContaining('test secret')]);
      }
    });
  });

  describe('loadDatabaseConfig (Prisma CLI, seed, database.ts)', () => {
    it('needs only APP_ENV and the DB settings, not the auth secrets', () => {
      const env: Env = { APP_ENV: 'development', DB_HOST: 'vinyl.db', DB_PORT_INT: '5432', DB_VINYLTRACK_NAME: 'vinyltrack', DB_VINYLTRACK_USER: 'vinyltrack', DB_PASSWORD: 'pw' };
      expect(loadDatabaseConfig(env, noFiles)).toEqual({ appEnv: 'development', databaseUrl: 'postgresql://vinyltrack:pw@vinyl.db:5432/vinyltrack?schema=public' });
    });

    it('keeps the production rules for the DB password', () => {
      const env: Env = { APP_ENV: 'production', DB_HOST: 'db', DB_PORT_INT: '5432', DB_VINYLTRACK_NAME: 'v', DB_VINYLTRACK_USER: 'v', DB_PASSWORD: 'pw' };
      expect(problemsOf(() => loadDatabaseConfig(env, noFiles))).toEqual([expect.stringContaining('DB_PASSWORD_FILE')]);
    });
  });

  it('ConfigError lists the problems in its message', () => {
    const error = new ConfigError(['a is missing', 'b is missing']);
    expect(error.message).toContain('a is missing');
    expect(error.message).toContain('b is missing');
  });
});
