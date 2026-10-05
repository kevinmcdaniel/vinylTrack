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
  authBootstrapOwnerEmail: string | undefined;
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

  const authBootstrapOwnerEmail = env.AUTH_BOOTSTRAP_OWNER_EMAIL || undefined;
  if (effectiveEnv === 'production' && authBootstrapOwnerEmail !== undefined) {
    problems.push('AUTH_BOOTSTRAP_OWNER_EMAIL is dev-only and must not be set in production');
  }

  if (problems.length > 0 || !appEnv || 'problem' in password) throw new ConfigError(problems);

  const databaseUrl =
    `postgresql://${encodeURIComponent(dbUser)}:${encodeURIComponent(password.value)}` +
    `@${host}:${dbPort}/${encodeURIComponent(dbName)}?schema=public`;

  return { appEnv, port, databaseUrl, authBootstrapOwnerEmail };
}

let cached: Config | undefined;

// Loads once from the real environment and filesystem; throws ConfigError on
// the first call if anything is missing or invalid.
export function getConfig(): Config {
  cached ??= loadConfig(process.env, (path) => readFileSync(path, 'utf8'));
  return cached;
}
