// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { stubAppEnv } from '@/tests/env';

const auth = vi.fn();
vi.mock('@/auth', () => ({ auth: () => auth() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT ${url}`); }),
  notFound: vi.fn(() => { throw new Error('NOT_FOUND'); }),
}));

const { default: AdminPage } = await import('./page');

const reply = (status: number, data: unknown = null) =>
  new Response(JSON.stringify({ data, status }), { status, headers: { 'content-type': 'application/json' } });
const user = { id: 'u-1', email: 'a@example.com', name: null, avatar: null, status: 'active', isAdmin: true };
const health = {
  be: { status: 'up', version: 'dev', uptimeSeconds: 60 },
  db: { status: 'up', latencyMs: 1 },
  mailer: { status: 'down', detail: 'unhealthy', version: 'dev', mode: 'gmail' },
};

// Route the BE calls by path: /auth/me, /admin/summary, /admin/health.
const signedInAs = (over: Partial<typeof user>, routes: Record<string, () => Response> = {}) => {
  auth.mockResolvedValue({ user: { id: 'u-1' } });
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const path = new URL(String(input)).pathname;
    if (routes[path]) return routes[path]();
    if (path.endsWith('/auth/me')) return reply(200, { ...user, ...over });
    if (path.endsWith('/admin/summary')) return reply(200, { pendingUsers: 3, unlinkedOwners: 0 });
    if (path.endsWith('/admin/health')) return reply(200, health);
    return reply(404);
  });
};
const html = async () => renderToStaticMarkup(await AdminPage());

describe('/admin', () => {
  beforeEach(() => stubAppEnv());
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); auth.mockReset(); });

  it('sends a signed-out visitor to sign-in', async () => {
    auth.mockResolvedValue(null);
    await expect(AdminPage()).rejects.toThrow('REDIRECT /sign-in');
  });

  it('sends a pending user to the waiting screen', async () => {
    signedInAs({ status: 'pending', isAdmin: false });
    await expect(AdminPage()).rejects.toThrow('REDIRECT /pending');
  });

  it('sends an approved non-admin home, without asking the BE for admin data', async () => {
    const fetch = signedInAs({ isAdmin: false });
    await expect(AdminPage()).rejects.toThrow('REDIRECT /');
    expect(fetch.mock.calls.map(([u]) => String(u))).not.toContainEqual(expect.stringContaining('/admin/'));
  });

  it('shows action items and workload health to an admin', async () => {
    signedInAs({});
    const out = await html();
    expect(out).toContain('3 access requests waiting');
    expect(out).toContain('href="/docs/hosting-maintenance"');
    expect(out).toContain('unhealthy');
  });

  it('still shows action items when the health check itself fails', async () => {
    signedInAs({}, { '/api/admin/health': () => reply(500, {}) });
    const out = await html();
    expect(out).toContain('3 access requests waiting');
    expect(out).toMatch(/Couldn.+t check/);
  });
});
