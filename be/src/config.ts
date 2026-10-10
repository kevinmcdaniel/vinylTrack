// config.ts - the only place the BE reads its environment (#65).
//
// Config (ports, hosts, names) arrives as plain env vars set by the compose
// file. Secrets arrive as Docker secret files: secret `db_password` is read
// from the path in DB_PASSWORD_FILE. The plain DB_PASSWORD form exists for CI
// and host-run tooling only, and is refused in production.
import { readFileSync } from 'node:fs';

export type Env = Record<string, string | undefined>;
export type ReadFile = (path: string) => string;
export type AppEnv = 'development' | 'test' | 'production';

export type Config = {
  appEnv: AppEnv;
  port: number;
  databaseUrl: string;
  // Release tag baked into the image at build time (#60); "dev" outside production.
  version: string;
  // Signs/verifies the FE→BE bearer token; only fe and be mount it (#73).
  internalApiSecret: string;
  turnstile: { secretKey: string; expectedHostname: string };
  // Turnstile automation mode for e2e (#11): development/test only, and only
  // when both secrets are set. Never present in production.
  automation?: { key: string; testSecretKey: string };
  // x-user-email identity for the BE suite and Bruno: development/test only.
  devIdentityHeader: boolean;
};

export class ConfigError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'ConfigError';
  }
}

const APP_ENVS: readonly AppEnv[] = ['development', 'test', 'production'];

export type SecretResult = { value: string } | { problem: string };

// `db_password` → DB_PASSWORD_FILE (or DB_PASSWORD outside production).
export function readSecret(name: string, env: Env, readFile: ReadFile, appEnv: AppEnv): SecretResult {
  const plainVar = name.toUpperCase();
  const fileVar = `${plainVar}_FILE`;
  const path = env[fileVar];
  const plain = env[plainVar];

  if (path !== undefined && plain !== undefined) return { problem: `set ${fileVar} or ${plainVar}, not both` };

  let value: string;
  if (path !== undefined) {
    try {
      value = readFile(path).replace(/\r?\n$/, '');
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return { problem: `${fileVar}: cannot read ${path} (${reason})` };
    }
  } else if (plain !== undefined) {
    if (appEnv === 'production') return { problem: `${plainVar} is not allowed in production; mount the secret and set ${fileVar}` };
    value = plain;
  } else {
    return { problem: `${fileVar} is not set (secret '${name}')` };
  }

  if (value === '') return { problem: `secret '${name}' is empty` };
  return { value };
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

  const host = required('DB_HOST');
  const dbPort = required('DB_PORT_INT');
  const dbName = required('DB_VINYLTRACK_NAME');
  const dbUser = required('DB_VINYLTRACK_USER');

  const password = readSecret('db_password', env, readFile, effectiveEnv);
  if ('problem' in password) problems.push(password.problem);

  let port = 3000;
  if (env.PORT !== undefined) {
    port = Number(env.PORT);
    if (!Number.isInteger(port) || port <= 0) problems.push(`PORT must be a positive integer (got '${env.PORT}')`);
  }

  let version = env.VINYLTRACK_VERSION || 'dev';
  if (effectiveEnv === 'production' && !env.VINYLTRACK_VERSION) {
    problems.push('VINYLTRACK_VERSION is not set (production images get it at build time)');
    version = '';
  }

  // The always-on fallback identity is gone (#73): a stale setting is an error
  // everywhere, so nobody keeps relying on it by accident.
  if (env.AUTH_BOOTSTRAP_OWNER_EMAIL !== undefined) {
    problems.push('AUTH_BOOTSTRAP_OWNER_EMAIL is no longer used (#73); remove it');
  }

  const publicHostname = required('PUBLIC_HOSTNAME');

  const internalApiSecret = readSecret('internal_api_secret', env, readFile, effectiveEnv);
  if ('problem' in internalApiSecret) problems.push(internalApiSecret.problem);
  else if (internalApiSecret.value.length < 32) problems.push("secret 'internal_api_secret' must be at least 32 characters");

  const turnstileSecret = readSecret('turnstile_secret_key', env, readFile, effectiveEnv);
  if ('problem' in turnstileSecret) problems.push(turnstileSecret.problem);
  else if (effectiveEnv === 'production' && TURNSTILE_TEST_SECRET.test(turnstileSecret.value)) {
    problems.push("secret 'turnstile_secret_key' is one of Cloudflare's test secrets; production needs the real one");
  }

  let automation: Config['automation'];
  if (effectiveEnv === 'production') {
    for (const v of ['AUTOMATION_KEY', 'TURNSTILE_TEST_SECRET_KEY']) {
      if (env[v] !== undefined || env[`${v}_FILE`] !== undefined) problems.push(`${v} is not allowed in production (automation mode is dev/test only)`);
    }
  } else {
    const key = readOptionalSecret('automation_key', env, readFile, effectiveEnv);
    const testSecret = readOptionalSecret('turnstile_test_secret_key', env, readFile, effectiveEnv);
    if (key && 'problem' in key) problems.push(key.problem);
    if (testSecret && 'problem' in testSecret) problems.push(testSecret.problem);
    if (!key !== !testSecret) {
      problems.push('AUTOMATION_KEY and TURNSTILE_TEST_SECRET_KEY must be set together (automation mode needs both)');
    } else if (key && testSecret && 'value' in key && 'value' in testSecret) {
      automation = { key: key.value, testSecretKey: testSecret.value };
    }
  }

  if (problems.length > 0 || !appEnv || 'problem' in password || 'problem' in internalApiSecret || 'problem' in turnstileSecret) {
    throw new ConfigError(problems);
  }

  const databaseUrl = buildDatabaseUrl(dbUser, password.value, host, dbPort, dbName);

  return {
    appEnv,
    port,
    databaseUrl,
    version,
    internalApiSecret: internalApiSecret.value,
    turnstile: { secretKey: turnstileSecret.value, expectedHostname: publicHostname },
    ...(automation ? { automation } : {}),
    devIdentityHeader: appEnv !== 'production',
  };
}

// Like readSecret, but "neither form set" is not a problem: the secret is optional.
function readOptionalSecret(name: string, env: Env, readFile: ReadFile, appEnv: AppEnv): SecretResult | undefined {
  const plainVar = name.toUpperCase();
  if (env[plainVar] === undefined && env[`${plainVar}_FILE`] === undefined) return undefined;
  return readSecret(name, env, readFile, appEnv);
}

// Cloudflare's published test secrets: always pass / always fail / token spent.
const TURNSTILE_TEST_SECRET = /^[123]x0+AA$/;

// Just what talking to the database needs (#73): APP_ENV plus the DB settings
// and db_password. The Prisma CLI (migrate, seed, studio) and database.ts use
// this, so they never need the auth secrets mounted.
export function loadDatabaseConfig(env: Env, readFile: ReadFile): { appEnv: AppEnv; databaseUrl: string } {
  const problems: string[] = [];
  const required = (key: string): string => {
    const value = env[key];
    if (value === undefined || value === '') {
      problems.push(`${key} is not set`);
      return '';
    }
    return value;
  };
  const appEnv = APP_ENVS.find((e) => e === env.APP_ENV);
  if (!appEnv) problems.push(`APP_ENV must be one of ${APP_ENVS.join(', ')} (got ${env.APP_ENV === undefined ? 'nothing' : `'${env.APP_ENV}'`})`);
  const host = required('DB_HOST');
  const dbPort = required('DB_PORT_INT');
  const dbName = required('DB_VINYLTRACK_NAME');
  const dbUser = required('DB_VINYLTRACK_USER');
  const password = readSecret('db_password', env, readFile, appEnv ?? 'production');
  if ('problem' in password) problems.push(password.problem);
  if (problems.length > 0 || !appEnv || 'problem' in password) throw new ConfigError(problems);
  return { appEnv, databaseUrl: buildDatabaseUrl(dbUser, password.value, host, dbPort, dbName) };
}

function buildDatabaseUrl(user: string, password: string, host: string, port: string, name: string): string {
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(name)}?schema=public`;
}

let cachedDatabase: { appEnv: AppEnv; databaseUrl: string } | undefined;

export function getDatabaseConfig(): { appEnv: AppEnv; databaseUrl: string } {
  cachedDatabase ??= loadDatabaseConfig(process.env, (path) => readFileSync(path, 'utf8'));
  return cachedDatabase;
}

let cached: Config | undefined;

// Loads once from the real environment and filesystem; throws ConfigError on
// the first call if anything is missing or invalid.
export function getConfig(): Config {
  cached ??= loadConfig(process.env, (path) => readFileSync(path, 'utf8'));
  return cached;
}
