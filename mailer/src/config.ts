// config.ts - the only place the mailer reads its environment (#65, #62).
//
// Config arrives as plain env vars from the compose file; secrets as Docker
// secret files (`<NAME>_FILE`), with the plain `<NAME>` form allowed outside
// production only. Log mode (print the link instead of sending) is for
// development and tests, and is refused in production.
import { readFileSync } from 'node:fs';

export type Env = Record<string, string | undefined>;
export type ReadFile = (path: string) => string;
export type AppEnv = 'development' | 'test' | 'production';
export type MailerMode = 'gmail' | 'log';

export type Config = {
  appEnv: AppEnv;
  port: number;
  version: string;
  mode: MailerMode;
  // The sender mailbox, e.g. vinyltrack@<family-domain>.
  from: string;
  // Callers (the BE) present this as a bearer token.
  mailerToken: string;
  // Sign-in links must start with this origin.
  linkOrigin: string;
  gmail?: { clientId: string; clientSecret: string; refreshToken: string };
};

export class ConfigError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'ConfigError';
  }
}

const APP_ENVS: readonly AppEnv[] = ['development', 'test', 'production'];
const MODES: readonly MailerMode[] = ['gmail', 'log'];
const EMAIL = /^[^\s@<>,]+@[^\s@<>,]+\.[^\s@<>,]+$/;

type SecretResult = { value: string } | { problem: string } | undefined;

// `mailer_token` → MAILER_TOKEN_FILE, or MAILER_TOKEN outside production.
function readSecret(name: string, env: Env, readFile: ReadFile, appEnv: AppEnv): SecretResult {
  const plainVar = name.toUpperCase();
  const fileVar = `${plainVar}_FILE`;
  const path = env[fileVar];
  const plain = env[plainVar];
  if (path === undefined && plain === undefined) return undefined;
  if (path !== undefined && plain !== undefined) return { problem: `set ${fileVar} or ${plainVar}, not both` };
  let value: string;
  if (path !== undefined) {
    try {
      value = readFile(path).replace(/\r?\n$/, '');
    } catch (error) {
      return { problem: `${fileVar}: cannot read ${path} (${error instanceof Error ? error.message : String(error)})` };
    }
  } else {
    if (appEnv === 'production') return { problem: `${plainVar} is not allowed in production; mount the secret and set ${fileVar}` };
    value = plain!;
  }
  return value === '' ? { problem: `secret '${name}' is empty` } : { value };
}

export function loadConfig(env: Env, readFile: ReadFile): Config {
  const problems: string[] = [];

  const required = (key: string): string => {
    const value = env[key];
    if (value === undefined || value === '') {
      problems.push(`${key} is not set`);
      return '';
    }
    return value;
  };

  const rawAppEnv = env.APP_ENV;
  const appEnv = APP_ENVS.find((e) => e === rawAppEnv);
  if (!appEnv) problems.push(`APP_ENV must be one of ${APP_ENVS.join(', ')} (got ${rawAppEnv === undefined ? 'nothing' : `'${rawAppEnv}'`})`);
  // Judge the rest by production rules when APP_ENV is unknown, so a typo can't loosen them.
  const effectiveEnv: AppEnv = appEnv ?? 'production';
  const production = effectiveEnv === 'production';

  const requiredSecret = (name: string, minLength = 1): string => {
    const r = readSecret(name, env, readFile, effectiveEnv);
    if (r === undefined) {
      problems.push(`${name.toUpperCase()}_FILE is not set (secret '${name}')`);
      return '';
    }
    if ('problem' in r) {
      problems.push(r.problem);
      return '';
    }
    if (r.value.length < minLength) problems.push(`secret '${name}' must be at least ${minLength} characters`);
    return r.value;
  };

  let port = 3000;
  if (env.PORT !== undefined) {
    port = Number(env.PORT);
    if (!Number.isInteger(port) || port <= 0) problems.push(`PORT must be a positive integer (got '${env.PORT}')`);
  }

  const version = env.VINYLTRACK_VERSION || (production ? '' : 'dev');
  if (!version) problems.push('VINYLTRACK_VERSION is not set (production images get it at build time)');

  const rawMode = env.MAILER_MODE ?? 'gmail';
  const mode = MODES.find((m) => m === rawMode);
  if (!mode) problems.push(`MAILER_MODE must be one of ${MODES.join(', ')} (got '${rawMode}')`);
  else if (production && mode === 'log') problems.push('MAILER_MODE=log is not allowed in production (it would print sign-in links instead of sending them)');

  const from = required('MAILER_FROM');
  if (from && !EMAIL.test(from)) problems.push(`MAILER_FROM must be an email address (got '${from}')`);

  const mailerToken = requiredSecret('mailer_token', 32);

  const publicHostname = required('PUBLIC_HOSTNAME');
  const fePort = env.FE_PORT_EXT ?? '5201';
  if (!production && !/^\d+$/.test(fePort)) problems.push(`FE_PORT_EXT must be a port number (got '${fePort}')`);
  // Normalised exactly as URL.origin (lowercase host, default port dropped),
  // because that's what links are compared against.
  let linkOrigin = '';
  if (publicHostname) {
    try {
      linkOrigin = new URL(production ? `https://${publicHostname}` : `http://${publicHostname}:${fePort}`).origin;
      if (linkOrigin === 'null') throw new Error('no origin');
    } catch {
      problems.push(`PUBLIC_HOSTNAME is not a valid hostname (got '${publicHostname}')`);
    }
  }

  let gmail: Config['gmail'];
  if (mode === 'gmail') {
    const clientId = required('GMAIL_CLIENT_ID');
    const clientSecret = requiredSecret('gmail_client_secret');
    const refreshToken = requiredSecret('gmail_refresh_token');
    gmail = { clientId, clientSecret, refreshToken };
  }

  if (problems.length > 0 || !appEnv || !mode) throw new ConfigError(problems);

  return { appEnv, port, version, mode, from, mailerToken, linkOrigin, ...(gmail ? { gmail } : {}) };
}

let cached: Config | undefined;

export function getConfig(): Config {
  cached ??= loadConfig(process.env, (path) => readFileSync(path, 'utf8'));
  return cached;
}
