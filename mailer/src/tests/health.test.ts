import { describe, it, expect, vi, afterEach } from 'vitest';
import { createHealthMonitor } from '../health.js';
import { TokenRevokedError } from '../gmail.js';

// GET /health's source of truth (#62): a token refresh at start and on a timer.
describe('createHealthMonitor', () => {
  afterEach(() => vi.useRealTimers());

  it('is always healthy in log mode, and never checks a token', async () => {
    const checkToken = vi.fn();
    const monitor = createHealthMonitor({ mode: 'log', checkToken, intervalMs: 1000, log: vi.fn() });
    await monitor.start();
    expect(monitor.isHealthy()).toBe(true);
    expect(checkToken).not.toHaveBeenCalled();
    monitor.stop();
  });

  it('starts unhealthy and turns healthy after a good first check', async () => {
    const monitor = createHealthMonitor({ mode: 'gmail', checkToken: vi.fn(async () => {}), intervalMs: 1000, log: vi.fn() });
    expect(monitor.isHealthy()).toBe(false);
    await monitor.start();
    expect(monitor.isHealthy()).toBe(true);
    monitor.stop();
  });

  it('goes unhealthy on a revoked token, logs it, and recovers when a later check passes', async () => {
    vi.useFakeTimers();
    const log = vi.fn();
    const checkToken = vi.fn(async () => {})
      .mockRejectedValueOnce(new TokenRevokedError('revoked'));
    const monitor = createHealthMonitor({ mode: 'gmail', checkToken, intervalMs: 60_000, retryMs: 1000, log });
    await monitor.start();
    expect(monitor.isHealthy()).toBe(false);
    expect(log.mock.calls.join(' ')).toMatch(/revoked|re-authori/i);
    await vi.advanceTimersByTimeAsync(1000);
    expect(monitor.isHealthy()).toBe(true);
    monitor.stop();
  });

  it('treats any failed check as unhealthy (Google unreachable included)', async () => {
    const monitor = createHealthMonitor({ mode: 'gmail', checkToken: vi.fn(async () => { throw new Error('ECONNRESET'); }), intervalMs: 1000, log: vi.fn() });
    await monitor.start();
    expect(monitor.isHealthy()).toBe(false);
    monitor.stop();
  });

  it('rechecks every retryMs while unhealthy, then every intervalMs once healthy', async () => {
    vi.useFakeTimers();
    const checkToken = vi.fn(async () => {})
      .mockRejectedValueOnce(new Error('blip'))
      .mockRejectedValueOnce(new Error('blip'));
    const monitor = createHealthMonitor({ mode: 'gmail', checkToken, intervalMs: 15 * 60_000, retryMs: 30_000, log: vi.fn() });
    await monitor.start();                       // 1st: fails
    expect(monitor.isHealthy()).toBe(false);
    await vi.advanceTimersByTimeAsync(30_000);   // 2nd: fails
    expect(checkToken).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(30_000);   // 3rd: passes
    expect(monitor.isHealthy()).toBe(true);
    await vi.advanceTimersByTimeAsync(60_000);   // healthy: no recheck at 30 s
    expect(checkToken).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(15 * 60_000);
    expect(checkToken).toHaveBeenCalledTimes(4);
    monitor.stop();
  });
});
