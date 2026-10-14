import { prisma } from '../database.js';
import { getConfig } from '../config.js';

// Admin back office (#90). Counts only: the dashboard links to the screen that
// lists them. Room for #87's stale-auth counts later.
export const adminSummaryService = async () => {
  const [pendingUsers, unlinkedOwners] = await Promise.all([
    prisma.user.count({ where: { status: 'pending' } }),
    prisma.owner.count({ where: { userId: null } }),
  ]);
  return { pendingUsers, unlinkedOwners };
};

// Short: an admin is waiting on the page, and a hung workload is the answer.
export const HEALTH_TIMEOUT_MS = 3_000;

type Down = { status: 'down'; detail: string };

// The error's name or HTTP status, never its message: a driver error can
// carry the connection string, and the mailer's body is not ours to log.
const down = (workload: string, detail: string | number): Down => {
  console.warn('admin', 'health', workload, detail);
  return { status: 'down', detail: String(detail) };
};
const errorName = (error: unknown) => (error instanceof Error ? error.name : 'error');

const checkDb = async (): Promise<{ status: 'up'; latencyMs: number } | Down> => {
  const started = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new DOMException('db did not answer', 'TimeoutError')), HEALTH_TIMEOUT_MS);
      }),
    ]);
    return { status: 'up', latencyMs: Math.round(performance.now() - started) };
  } catch (error) {
    return down('db', errorName(error));
  } finally {
    clearTimeout(timer);
  }
};

type MailerHealth = { status: 'up' | 'not configured'; version?: string; mode?: string } | (Down & { version?: string; mode?: string });

// GET /health on the mailer (#62): 503 when its Gmail grant is bad. Version
// and mode come through either way, so a down mailer still says which release.
const checkMailer = async (): Promise<MailerHealth> => {
  const mailer = getConfig().mailer;
  if (!mailer) return { status: 'not configured' };
  try {
    const res = await fetch(`${mailer.url}/health`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
    const data = (await res.json().catch(() => null))?.data;
    const about = {
      ...(typeof data?.version === 'string' ? { version: data.version } : {}),
      ...(typeof data?.mode === 'string' ? { mode: data.mode } : {}),
    };
    if (res.ok) return { status: 'up', ...about };
    return { ...down('mailer', res.status), ...about };
  } catch (error) {
    return down('mailer', errorName(error));
  }
};

// One failing workload is a `down` entry, never a 500: the page exists to
// show exactly that. /api/health stays the public liveness check.
export const adminHealthService = async () => {
  const [db, mailer] = await Promise.all([checkDb(), checkMailer()]);
  return {
    be: { status: 'up' as const, version: getConfig().version, uptimeSeconds: Math.round(process.uptime()) },
    db,
    mailer,
  };
};
