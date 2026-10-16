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

const { default: OwnersPage } = await import('./page');

const reply = (status: number, data: unknown = null) =>
  new Response(JSON.stringify({ data, status }), { status, headers: { 'content-type': 'application/json' } });
const me = { id: 'u-1', email: 'kevin@example.com', name: 'Kevin', avatar: null, status: 'active', isAdmin: false };
const owners = [
  { id: 'o-1', name: 'Kevin', userId: 'u-1' },
  { id: 'o-2', name: 'Grandma Ruth', userId: null },
];

const signedInAs = (over: Partial<typeof me> = {}) => {
  auth.mockResolvedValue({ user: { id: 'u-1' } });
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith('/auth/me')) return reply(200, { ...me, ...over });
    if (path.endsWith('/owner')) return reply(200, owners);
    return reply(404);
  });
};
const html = async (error?: string) =>
  renderToStaticMarkup(await OwnersPage({ searchParams: Promise.resolve(error ? { error } : {}) }));

describe('/owners', () => {
  beforeEach(() => stubAppEnv());
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); auth.mockReset(); });

  it('sends a signed-out visitor to sign-in', async () => {
    auth.mockResolvedValue(null);
    await expect(OwnersPage({ searchParams: Promise.resolve({}) })).rejects.toThrow('REDIRECT /sign-in');
  });

  it('lists every owner, saying which have an account', async () => {
    signedInAs();
    const out = await html();
    expect(out).toContain('Grandma Ruth');
    expect(out).toContain('Linked to an account');
    expect(out).toContain('No account');
  });

  it('lets any member add and rename, but not delete', async () => {
    signedInAs();
    const out = await html();
    expect(out).toContain('Add owner');
    expect(out).toMatch(/Rename/);
    expect(out).not.toMatch(/>Delete</);
  });

  it('shows delete to an admin', async () => {
    signedInAs({ isAdmin: true });
    expect(await html()).toMatch(/>Delete</);
  });

  it('explains a known error code', async () => {
    signedInAs({ isAdmin: true });
    expect(await html('in-use')).toMatch(/still owns copies/);
  });

  // ?error= is user-controlled: an unknown code gets the generic line, never itself.
  it('never echoes an unknown error code', async () => {
    signedInAs();
    const out = await html('<script>x</script>');
    expect(out).toMatch(/Something went wrong/);
    expect(out).not.toContain('<script>x');
    expect(out).not.toContain('&lt;script&gt;');
  });
});
