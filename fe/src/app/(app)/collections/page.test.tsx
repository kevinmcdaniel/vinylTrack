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

const { default: CollectionsPage } = await import('./page');

const reply = (status: number, data: unknown = null) =>
  new Response(JSON.stringify({ data, status }), { status, headers: { 'content-type': 'application/json' } });
const me = { id: 'u-1', email: 'kevin@example.com', name: 'Kevin', avatar: null, status: 'active', isAdmin: false };
const mine = { id: 'c1', name: 'Vinyl', kind: 'physical', ownerId: 'u-1', owner: { id: 'u-1', name: 'Kevin' }, notes: null, albumCount: 42 };
const shared = { id: 'c2', name: 'Mom’s 45s', kind: 'physical', ownerId: 'u-2', owner: { id: 'u-2', name: 'Ruth' }, notes: null, albumCount: 1 };

const signedIn = (over: Partial<typeof me> = {}, collections: unknown[] = [mine, shared]) => {
  auth.mockResolvedValue({ user: { id: 'u-1' } });
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith('/auth/me')) return reply(200, { ...me, ...over });
    if (path.endsWith('/collection')) return reply(200, collections);
    return reply(404);
  });
};
const html = async () => renderToStaticMarkup(await CollectionsPage());

// #140: one place to find every collection and get to its settings.
describe('/collections', () => {
  beforeEach(() => stubAppEnv());
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); auth.mockReset(); });

  it('sends a signed-out visitor to sign-in', async () => {
    auth.mockResolvedValue(null);
    await expect(CollectionsPage()).rejects.toThrow('REDIRECT /sign-in');
  });

  it('lists each collection with its album count, linking it', async () => {
    signedIn();
    const out = await html();
    expect(out).toContain('href="/collection/c1"');
    expect(out).toContain('42 albums');
    expect(out).toContain('1 album · Shared by Ruth');
    expect(out).toContain('href="/collection/new"');
  });

  it('gives Settings to the owner, and says who shared the rest', async () => {
    signedIn();
    const out = await html();
    expect(out).toContain('href="/collection/c1/settings"');
    expect(out).not.toContain('href="/collection/c2/settings"');
    expect(out).toContain('Shared by Ruth');
  });

  it('gives an admin Settings on every collection, saying whose', async () => {
    signedIn({ isAdmin: true });
    const out = await html();
    expect(out).toContain('href="/collection/c2/settings"');
    expect(out).toContain('Owned by Ruth');
    expect(out).not.toContain('Shared by');
  });

  it('has an empty state that starts one', async () => {
    signedIn({}, []);
    const out = await html();
    expect(out).toContain('No collections yet.');
    expect(out).toContain('href="/collection/new"');
  });
});
