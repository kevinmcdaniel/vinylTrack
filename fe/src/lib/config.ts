/**
 * The only place the FE reads its environment (#65). Mirrors be/src/config.ts:
 * config arrives as plain env vars from the compose file, secrets as Docker
 * secret files (`<NAME>_FILE`), with the plain `<NAME>` form allowed outside
 * production only. Dev-only paths (dev sign-in, Turnstile automation) are
 * refused in production (#73).
 */
import fs from 'node:fs';

export type Env = Record<string, string | undefined>;
export type ReadFile = (path: string) => string;
export type AppEnv = 'development' | 'test' | 'production';

export type Config = {
  appEnv: AppEnv;
  apiBaseUrl: string;
  // Release tag baked into the image at build time (#60); "dev" outside production.
  version: string;
  // vinyl.<family-domain> in production; Auth.js URLs and Turnstile hostname.
  publicHostname: string;
  // Encrypts the Auth.js session cookie.
  authSecret: string;
  // Signs the bearer token on every FE→BE call; the BE holds the same secret.
  internalApiSecret: string;
  // Optional in development/test (the dev sign-in covers it), required in production.
  google?: { clientId: string; clientSecret: string };
  turnstile: { siteKey: string };
  // "Sign in as a seeded user": development/test only.
  devSignIn: boolean;
  // Turnstile automation mode for e2e (#11): development/test only.
  automation?: { key: string; testSiteKey: string };
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
// Cloudflare's published test site keys (always pass / always fail / interactive).
const TURNSTILE_TEST_SITE_KEY = /^[123]x0+A[AB]$/;

type SecretResult = { value: string } | { problem: string } | undefined;

// `auth_secret` → AUTH_SECRET_FILE, or AUTH_SECRET outside production.
// undefined = neither form set (the caller decides whether that's a problem).
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

  const rawAppEnv = env.APP_ENV;
  const appEnv = APP_ENVS.find((e) => e === rawAppEnv);
  if (!appEnv) problems.push(`APP_ENV must be one of ${APP_ENVS.join(', ')} (got ${rawAppEnv === undefined ? 'nothing' : `'${rawAppEnv}'`})`);
  // Judge the rest by production rules when APP_ENV is unknown, so a typo can't loosen them.
  const effectiveEnv: AppEnv = appEnv ?? 'production';
  const production = effectiveEnv === 'production';

  const beUrl = required('BE_URL');
  const bePort = env.BE_PORT_INT;
  if (bePort === undefined || bePort === '') {
    problems.push('BE_PORT_INT is not set');
  } else if (!/^\d+$/.test(bePort)) {
    problems.push(`BE_PORT_INT must be a port number (got '${bePort}')`);
  }

  const version = env.VINYLTRACK_VERSION || (production ? '' : 'dev');
  if (!version) problems.push('VINYLTRACK_VERSION is not set (production images get it at build time)');

  // The FE identifies callers by session now (#73); the old fallback is gone.
  if (env.AUTH_BOOTSTRAP_OWNER_EMAIL !== undefined) {
    problems.push('AUTH_BOOTSTRAP_OWNER_EMAIL is no longer used (#73); remove it');
  }

  const publicHostname = required('PUBLIC_HOSTNAME');
  const authSecret = requiredSecret('auth_secret', 32);
  const internalApiSecret = requiredSecret('internal_api_secret', 32);

  const siteKey = required('TURNSTILE_SITE_KEY');
  if (production && TURNSTILE_TEST_SITE_KEY.test(siteKey)) {
    problems.push("TURNSTILE_SITE_KEY is one of Cloudflare's test site keys; production needs the real one");
  }

  // Google: both settings or neither outside production; both required in it.
  let google: Config['google'];
  const clientId = env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = readSecret('google_oauth_client_secret', env, readFile, effectiveEnv);
  if (clientSecret && 'problem' in clientSecret) problems.push(clientSecret.problem);
  if (clientId && clientSecret && 'value' in clientSecret) {
    google = { clientId, clientSecret: clientSecret.value };
  } else if (production) {
    if (!clientId) problems.push('GOOGLE_OAUTH_CLIENT_ID is not set (required in production)');
    if (!clientSecret) problems.push("GOOGLE_OAUTH_CLIENT_SECRET_FILE is not set (secret 'google_oauth_client_secret', required in production)");
  } else if (!clientId !== !clientSecret) {
    problems.push('GOOGLE_OAUTH_CLIENT_ID and the google_oauth_client_secret secret must be set together');
  }

  let automation: Config['automation'];
  if (production) {
    for (const v of ['AUTOMATION_KEY', 'TURNSTILE_TEST_SITE_KEY']) {
      if (env[v] !== undefined || env[`${v}_FILE`] !== undefined) problems.push(`${v} is not allowed in production (automation mode is dev/test only)`);
    }
  } else {
    const key = readSecret('automation_key', env, readFile, effectiveEnv);
    const testSiteKey = env.TURNSTILE_TEST_SITE_KEY;
    if (key && 'problem' in key) problems.push(key.problem);
    if (!key !== !testSiteKey) {
      problems.push('AUTOMATION_KEY and TURNSTILE_TEST_SITE_KEY must be set together (automation mode needs both)');
    } else if (key && 'value' in key && testSiteKey) {
      automation = { key: key.value, testSiteKey };
    }
  }

  if (problems.length > 0 || !appEnv) throw new ConfigError(problems);

  return {
    appEnv,
    apiBaseUrl: `${beUrl}:${bePort}/api`,
    version,
    publicHostname,
    authSecret,
    internalApiSecret,
    ...(google ? { google } : {}),
    turnstile: { siteKey },
    devSignIn: !production,
    ...(automation ? { automation } : {}),
  };
}

// Read on every call rather than cached: it's a handful of lookups, and it
// keeps tests free to stub the environment per test.
export function getConfig(): Config {
  return loadConfig(process.env, (p) => fs.readFileSync(p, 'utf8'));
}
