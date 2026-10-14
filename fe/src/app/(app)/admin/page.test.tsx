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
  be: { status: 'up', version: 'v0.4.0', uptimeSeconds: 5 },
  db: { status: 'up', latencyMs: 1 },
  mailer: { status: 'up', version: 'v0.4.0', mode: 'log' },
};

// Route BE calls by path; anything else is a test bug.
const backend = (me: object, routes: Record<string, () => Response>) =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith('/auth/me')) return reply(200, { ...user, ...me });
    const route = Object.keys(routes).find((r) => path.endsWith(r));
    if (!route) throw new Error(`unexpected fetch ${path}`);
    return routes[route]!();
  });

// Admin back office (#90).
describe('/admin', () => {
  beforeEach(() => { stubAppEnv({ VINYLTRACK_VERSION: 'v0.4.0' }); auth.mockResolvedValue({ user: { id: 'u-1' } }); });
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); auth.mockReset(); });

  it('sends a signed-out visitor to sign-in', async () => {
    auth.mockResolvedValue(null);
    await expect(AdminPage()).rejects.toThrow('REDIRECT /sign-in');
  });

  it('sends an approved non-admin home, without asking the BE for admin data', async () => {
    const fetchSpy = backend({ isAdmin: false }, {});
    await expect(AdminPage()).rejects.toThrow('REDIRECT /');
    expect(fetchSpy.mock.calls.map(([u]) => String(u)).some((u) => u.includes('/admin/'))).toBe(false);
  });

  it('renders action items and workload health for an admin', async () => {
    backend({}, { '/admin/summary': () => reply(200, { pendingUsers: 3, unlinkedOwners: 0 }), '/admin/health': () => reply(200, health) });
    const html = renderToStaticMarkup(await AdminPage());
    expect(html).toContain('3 access requests');
    expect(html).toContain('href="/admin/requests"');
    expect(html).toContain('v0.4.0');
  });

  it('still renders when the BE does not answer, showing it down', async () => {
    backend({}, { '/admin/summary': () => reply(502), '/admin/health': () => reply(502) });
    const html = renderToStaticMarkup(await AdminPage());
    expect(html).toMatch(/Couldn.*t load the action items/);
    const be = html.split('aria-label="be"')[1]!.split('</li>')[0];
    expect(be).toContain('>down<');
  });
});
