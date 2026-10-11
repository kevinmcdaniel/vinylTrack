import { describe, it, expect } from 'vitest';
import { ConfigError, loadConfig, type Env } from '../config.js';

// Pure tests: env and file reads are injected (#65, #62).
const files = (map: Record<string, string>) => (p: string) => {
  if (p in map) return map[p]!;
  throw Object.assign(new Error(`ENOENT: ${p}`), { code: 'ENOENT' });
};
const noFiles = files({});
const TOKEN = 't'.repeat(32);

const dev: Env = {
  APP_ENV: 'development',
  PUBLIC_HOSTNAME: 'localhost',
  MAILER_FROM: 'vinyltrack@example.org',
  MAILER_TOKEN: TOKEN,
  MAILER_MODE: 'log',
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
  it('runs in log mode in development with no Gmail credentials', () => {
    const config = loadConfig(dev, noFiles);
    expect(config).toMatchObject({ appEnv: 'development', mode: 'log', from: 'vinyltrack@example.org', mailerToken: TOKEN, port: 3000 });
    expect(config.gmail).toBeUndefined();
  });

  it('allows links to the dev FE: http://PUBLIC_HOSTNAME:FE_PORT_EXT (default 5201)', () => {
    expect(loadConfig(dev, noFiles).linkOrigin).toBe('http://localhost:5201');
    expect(loadConfig({ ...dev, FE_PORT_EXT: '5301' }, noFiles).linkOrigin).toBe('http://localhost:5301');
  });

  it('reports every missing value at once', () => {
    const problems = problemsOf(() => loadConfig({}, noFiles));
    for (const name of ['APP_ENV', 'PUBLIC_HOSTNAME', 'MAILER_FROM', 'MAILER_TOKEN_FILE']) {
      expect(problems.some((p) => p.includes(name)), name).toBe(true);
    }
  });

  it('requires a mailer token of at least 32 characters and a valid sender address', () => {
    expect(problemsOf(() => loadConfig({ ...dev, MAILER_TOKEN: 'short' }, noFiles))).toEqual([expect.stringContaining('mailer_token')]);
    expect(problemsOf(() => loadConfig({ ...dev, MAILER_FROM: 'not-an-address' }, noFiles))).toEqual([expect.stringContaining('MAILER_FROM')]);
  });

  it('only accepts gmail or log as MAILER_MODE, defaulting to gmail', () => {
    expect(problemsOf(() => loadConfig({ ...dev, MAILER_MODE: 'smtp' }, noFiles))).toEqual([expect.stringContaining('MAILER_MODE')]);
    const { MAILER_MODE: _m, ...noMode } = dev;
    expect(problemsOf(() => loadConfig(noMode, noFiles)).join('\n')).toMatch(/GMAIL_CLIENT_ID/);
  });

  it('gmail mode needs the client id and both Gmail secrets', () => {
    const gmailDev: Env = { ...dev, MAILER_MODE: 'gmail', GMAIL_CLIENT_ID: 'cid.apps.googleusercontent.com', GMAIL_CLIENT_SECRET: 'csecret', GMAIL_REFRESH_TOKEN: 'rtoken' };
    expect(loadConfig(gmailDev, noFiles).gmail).toEqual({ clientId: 'cid.apps.googleusercontent.com', clientSecret: 'csecret', refreshToken: 'rtoken' });
    const { GMAIL_REFRESH_TOKEN: _r, ...missing } = gmailDev;
    expect(problemsOf(() => loadConfig(missing, noFiles))).toEqual([expect.stringContaining('gmail_refresh_token')]);
  });

  describe('APP_ENV=production', () => {
    const prod: Env = {
      APP_ENV: 'production',
      VINYLTRACK_VERSION: 'v1.2.3',
      PUBLIC_HOSTNAME: 'vinyl.example.org',
      MAILER_FROM: 'vinyltrack@example.org',
      GMAIL_CLIENT_ID: 'cid.apps.googleusercontent.com',
      MAILER_TOKEN_FILE: '/run/secrets/mailer_token',
      GMAIL_CLIENT_SECRET_FILE: '/run/secrets/gmail_client_secret',
      GMAIL_REFRESH_TOKEN_FILE: '/run/secrets/gmail_refresh_token',
    };
    const prodFiles = files({
      '/run/secrets/mailer_token': `${TOKEN}\n`,
      '/run/secrets/gmail_client_secret': 'csecret\n',
      '/run/secrets/gmail_refresh_token': 'rtoken\n',
    });

    it('sends through Gmail, with links allowed only on https://PUBLIC_HOSTNAME', () => {
      const config = loadConfig(prod, prodFiles);
      expect(config.mode).toBe('gmail');
      expect(config.linkOrigin).toBe('https://vinyl.example.org');
      expect(config.gmail).toEqual({ clientId: 'cid.apps.googleusercontent.com', clientSecret: 'csecret', refreshToken: 'rtoken' });
    });

    it('refuses log mode: production must really send', () => {
      expect(problemsOf(() => loadConfig({ ...prod, MAILER_MODE: 'log' }, prodFiles))).toEqual([expect.stringContaining('MAILER_MODE')]);
    });

    it('refuses plain-variable secrets', () => {
      const { MAILER_TOKEN_FILE: _f, ...noFile } = prod;
      expect(problemsOf(() => loadConfig({ ...noFile, MAILER_TOKEN: TOKEN }, prodFiles))).toEqual([expect.stringContaining('MAILER_TOKEN_FILE')]);
    });

    it('judges an unknown APP_ENV by production rules', () => {
      expect(problemsOf(() => loadConfig({ ...dev, APP_ENV: 'prod' }, noFiles)).join('\n')).toMatch(/MAILER_MODE|MAILER_TOKEN_FILE/);
    });
  });

  it('ConfigError lists the problems in its message', () => {
    expect(new ConfigError(['a is missing']).message).toContain('a is missing');
  });
});
