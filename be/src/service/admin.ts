import { prisma } from '../database.js';
import { getConfig } from '../config.js';
import { checkMailerHealth } from '../common/mailerClient.js';

// Back-office action items (#90): counts only, one cheap query each. The
// header badge calls this on every admin page render, so nothing slow here.
export const adminSummaryService = async () => {
  const [pendingUsers, unlinkedOwners] = await Promise.all([
    prisma.user.count({ where: { status: 'pending' } }),
    prisma.owner.count({ where: { userId: null } }),
  ]);
  return { pendingUsers, unlinkedOwners };
};

export const DB_HEALTH_TIMEOUT_MS = 2_000;

class TimeoutError extends Error {
  override name = 'TimeoutError';
}

// Only the error's name is logged or returned: a Prisma message can carry
// the connection string.
const checkDb = async () => {
  const started = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new TimeoutError()), DB_HEALTH_TIMEOUT_MS); }),
    ]);
    return { status: 'up' as const, latencyMs: Math.round(performance.now() - started) };
  } catch (error) {
    const name = error instanceof Error ? error.name : 'error';
    console.warn('admin', 'health', 'db', name);
    return { status: 'down' as const, detail: name };
  } finally {
    clearTimeout(timer);
  }
};

// Per workload, never a 500: one being down is the answer, not an error.
// /api/health (public, compose healthchecks) stays as it is.
export const adminHealthService = async () => {
  const [db, mailer] = await Promise.all([checkDb(), checkMailerHealth()]);
  const be = { status: 'up' as const, version: getConfig().version, uptimeSeconds: Math.round(process.uptime()) };
  return { be, db, mailer };
};
