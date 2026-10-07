import { describe, it, expect } from 'vitest';
import { ConfigError, loadConfig, type Env } from './config';

// Pure tests: the env is passed in, so nothing here reads process.env (#65).

const base: Env = { APP_ENV: 'development', BE_URL: 'http://vinyl.be', BE_PORT_INT: '3000' };

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
    expect(loadConfig(base).apiBaseUrl).toBe('http://vinyl.be:3000/api');
  });

  it('reports VINYLTRACK_VERSION, and "dev" when it is unset outside production', () => {
    expect(loadConfig({ ...base, VINYLTRACK_VERSION: 'v1.2.3' }).version).toBe('v1.2.3');
    expect(loadConfig(base).version).toBe('dev');
  });

  it('requires VINYLTRACK_VERSION in production', () => {
    expect(problemsOf(() => loadConfig({ ...base, APP_ENV: 'production' }))).toEqual([expect.stringContaining('VINYLTRACK_VERSION')]);
  });

  it('passes the dev bootstrap identity through outside production', () => {
    expect(loadConfig({ ...base, AUTH_BOOTSTRAP_OWNER_EMAIL: 'kevin@example.com' }).authBootstrapOwnerEmail).toBe('kevin@example.com');
    expect(loadConfig(base).authBootstrapOwnerEmail).toBeUndefined();
  });

  it('reports every missing value at once', () => {
    const problems = problemsOf(() => loadConfig({}));
    for (const name of ['APP_ENV', 'BE_URL', 'BE_PORT_INT']) {
      expect(problems.some((p) => p.includes(name))).toBe(true);
    }
  });

  it('rejects a non-numeric BE_PORT_INT', () => {
    expect(problemsOf(() => loadConfig({ ...base, BE_PORT_INT: 'abc' }))).toEqual([expect.stringContaining('BE_PORT_INT')]);
  });

  it('only accepts known APP_ENV values', () => {
    expect(problemsOf(() => loadConfig({ ...base, APP_ENV: 'prod' }))).toContainEqual(expect.stringContaining('APP_ENV'));
  });

  it('refuses AUTH_BOOTSTRAP_OWNER_EMAIL in production', () => {
    const problems = problemsOf(() => loadConfig({ ...base, APP_ENV: 'production', VINYLTRACK_VERSION: 'v1.2.3', AUTH_BOOTSTRAP_OWNER_EMAIL: 'kevin@example.com' }));
    expect(problems).toEqual([expect.stringContaining('AUTH_BOOTSTRAP_OWNER_EMAIL')]);
  });

  it('judges an unknown APP_ENV by production rules, so a typo cannot loosen them', () => {
    const problems = problemsOf(() => loadConfig({ ...base, APP_ENV: 'prod', AUTH_BOOTSTRAP_OWNER_EMAIL: 'kevin@example.com' }));
    expect(problems).toContainEqual(expect.stringContaining('AUTH_BOOTSTRAP_OWNER_EMAIL'));
  });

  it('starts in production without the dev identity', () => {
    expect(loadConfig({ ...base, APP_ENV: 'production', VINYLTRACK_VERSION: 'v1.2.3' }).appEnv).toBe('production');
  });
});
