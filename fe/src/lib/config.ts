/**
 * The only place the FE reads its environment (#65). Mirrors be/src/config.ts:
 * config arrives as plain env vars from the compose file, and the dev-only
 * identity is refused in production. The FE has no secrets yet; when #11 adds
 * some they come in as Docker secret files, the same way the BE reads them.
 */

export type Env = Record<string, string | undefined>;
export type AppEnv = 'development' | 'test' | 'production';

export type Config = {
  appEnv: AppEnv;
  apiBaseUrl: string;
  authBootstrapOwnerEmail: string | undefined;
};

export class ConfigError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`Invalid configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'ConfigError';
    this.problems = problems;
  }
}

const APP_ENVS: readonly AppEnv[] = ['development', 'test', 'production'];

export function loadConfig(env: Env): Config {
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

  const beUrl = required('BE_URL');
  const bePort = env.BE_PORT_INT;
  if (bePort === undefined || bePort === '') {
    problems.push('BE_PORT_INT is not set');
  } else if (!/^\d+$/.test(bePort)) {
    problems.push(`BE_PORT_INT must be a port number (got '${bePort}')`);
  }

  const authBootstrapOwnerEmail = env.AUTH_BOOTSTRAP_OWNER_EMAIL || undefined;
  if (effectiveEnv === 'production' && authBootstrapOwnerEmail !== undefined) {
    problems.push('AUTH_BOOTSTRAP_OWNER_EMAIL is dev-only and must not be set in production');
  }

  if (problems.length > 0 || !appEnv) throw new ConfigError(problems);

  return { appEnv, apiBaseUrl: `${beUrl}:${bePort}/api`, authBootstrapOwnerEmail };
}

// Read on every call rather than cached: it's a handful of lookups, and it
// keeps tests free to stub the environment per test.
export function getConfig(): Config {
  return loadConfig(process.env);
}
