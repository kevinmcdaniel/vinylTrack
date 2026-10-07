import { describe, it, expect } from 'vitest';
import { ConfigError, loadConfig, readSecret, type Env } from '../config.js';

// Pure tests: env and file reads are injected, so nothing here touches
// process.env or the filesystem (#65).

const files = (map: Record<string, string>) => (path: string) => {
  if (path in map) return map[path]!;
  throw Object.assign(new Error(`ENOENT: no such file, open '${path}'`), { code: 'ENOENT' });
};
const noFiles = files({});

const base: Env = {
  APP_ENV: 'development',
  DB_HOST: 'vinyl.db',
  DB_PORT_INT: '5432',
  DB_VINYLTRACK_NAME: 'vinyltrack',
  DB_VINYLTRACK_USER: 'vinyltrack',
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

  it('passes the dev bootstrap identity through outside production', () => {
    const config = loadConfig({ ...base, DB_PASSWORD: 'pw', AUTH_BOOTSTRAP_OWNER_EMAIL: 'kevin@example.com' }, noFiles);
    expect(config.authBootstrapOwnerEmail).toBe('kevin@example.com');
  });

  it('requires APP_ENV, and only accepts known values', () => {
    const { APP_ENV: _omit, ...noAppEnv } = base;
    expect(problemsOf(() => loadConfig({ ...noAppEnv, DB_PASSWORD: 'pw' }, noFiles))).toContainEqual(expect.stringContaining('APP_ENV'));
    expect(problemsOf(() => loadConfig({ ...base, APP_ENV: 'prod', DB_PASSWORD: 'pw' }, noFiles))).toContainEqual(expect.stringContaining('APP_ENV'));
  });

  it('judges an unknown APP_ENV by production rules, so a typo cannot loosen them', () => {
    const problems = problemsOf(() => loadConfig({ ...base, APP_ENV: 'prod', DB_PASSWORD: 'pw', AUTH_BOOTSTRAP_OWNER_EMAIL: 'k@example.com' }, noFiles));
    expect(problems).toContainEqual(expect.stringContaining('DB_PASSWORD_FILE'));
    expect(problems).toContainEqual(expect.stringContaining('AUTH_BOOTSTRAP_OWNER_EMAIL'));
  });

  it('reports every problem at once, not just the first', () => {
    const problems = problemsOf(() => loadConfig({ APP_ENV: 'development', PORT: 'abc' }, noFiles));
    for (const name of ['DB_HOST', 'DB_PORT_INT', 'DB_VINYLTRACK_NAME', 'DB_VINYLTRACK_USER', 'DB_PASSWORD_FILE', 'PORT']) {
      expect(problems.some((p) => p.includes(name))).toBe(true);
    }
    expect(problemsOf(() => loadConfig({ APP_ENV: 'development' }, noFiles)).join('\n')).toMatch(/DB_HOST[\s\S]*DB_PASSWORD_FILE/);
  });

  describe('APP_ENV=production', () => {
    const prod: Env = { ...base, APP_ENV: 'production', DB_PASSWORD_FILE: '/run/secrets/db_password', VINYLTRACK_VERSION: 'v1.2.3' };
    const prodFiles = files({ '/run/secrets/db_password': 'pw\n' });

    it('requires VINYLTRACK_VERSION, so a deployed build always says what it is', () => {
      const { VINYLTRACK_VERSION: _omit, ...noVersion } = prod;
      expect(problemsOf(() => loadConfig(noVersion, prodFiles))).toEqual([expect.stringContaining('VINYLTRACK_VERSION')]);
    });

    it('starts from secret files', () => {
      expect(loadConfig(prod, prodFiles).appEnv).toBe('production');
    });

    it('refuses AUTH_BOOTSTRAP_OWNER_EMAIL', () => {
      const problems = problemsOf(() => loadConfig({ ...prod, AUTH_BOOTSTRAP_OWNER_EMAIL: 'kevin@example.com' }, prodFiles));
      expect(problems).toEqual([expect.stringContaining('AUTH_BOOTSTRAP_OWNER_EMAIL')]);
    });

    it('refuses a plain DB_PASSWORD', () => {
      const { DB_PASSWORD_FILE: _omit, ...noFile } = prod;
      const problems = problemsOf(() => loadConfig({ ...noFile, DB_PASSWORD: 'pw' }, noFiles));
      expect(problems).toEqual([expect.stringContaining('DB_PASSWORD_FILE')]);
    });
  });

  it('ConfigError lists the problems in its message', () => {
    const error = new ConfigError(['a is missing', 'b is missing']);
    expect(error.message).toContain('a is missing');
    expect(error.message).toContain('b is missing');
  });
});
