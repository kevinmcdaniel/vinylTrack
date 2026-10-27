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

const { default: UsersPage } = await import('./page');

const reply = (status: number, data: unknown = null) =>
  new Response(JSON.stringify({ data, status }), { status, headers: { 'content-type': 'application/json' } });
const me = { id: 'u-1', email: 'me@family.example', name: 'Kevin', avatar: null, status: 'active', isAdmin: true };
const others = [
  { ...me, createdAt: '2026-10-01T00:00:00Z' },
  { id: 'u-2', email: 'kevin@gmail.example', name: 'Kevin', avatar: null, status: 'active', isAdmin: false, createdAt: '2026-10-02T00:00:00Z' },
];

const signedInAs = (over: Partial<typeof me>) => {
  auth.mockResolvedValue({ user: { id: 'u-1' } });
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/auth/me')) return reply(200, { ...me, ...over });
    if (url.pathname.endsWith('/user')) return reply(200, others);
    if (url.pathname.endsWith('/owner')) return reply(200, []);
    return reply(404);
  });
};
const html = async () => renderToStaticMarkup(await UsersPage({ searchParams: Promise.resolve({}) }));

describe('/admin/users', () => {
  beforeEach(() => stubAppEnv());
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); auth.mockReset(); });

  it('sends an approved non-admin home without asking for the user list', async () => {
    const fetch = signedInAs({ isAdmin: false });
    await expect(UsersPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('REDIRECT /');
    expect(fetch.mock.calls.map(([u]) => new URL(String(u)).pathname)).not.toContain('/api/user');
  });

  // #124: /admin/requests shows pending only, so an approved account vanished.
  it('lists every account, whatever its status', async () => {
    const fetch = signedInAs({});
    const out = await html();
    expect(out).toContain('me@family.example');
    expect(out).toContain('kevin@gmail.example');
    const userCall = fetch.mock.calls.map(([u]) => new URL(String(u))).find((u) => u.pathname.endsWith('/user'))!;
    expect(userCall.searchParams.has('status')).toBe(false);
  });
});
