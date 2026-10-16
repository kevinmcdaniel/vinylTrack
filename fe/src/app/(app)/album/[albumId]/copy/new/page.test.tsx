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

const { default: NewCopyPage } = await import('./page');

const reply = (status: number, data: unknown = null) =>
  new Response(JSON.stringify({ data, status }), { status, headers: { 'content-type': 'application/json' } });
const me = { id: 'u-1', email: 'kevin@example.com', name: 'Kevin', avatar: null, status: 'active', isAdmin: false };
const album = (kind: string) => ({
  id: 'a-1', collectionId: 'c1', title: 'Kind of Blue', format: 'LP', year: 1959, genre: null, notes: null, coverImageUrl: null,
  artists: [], collection: { id: 'c1', name: 'Vinyl', kind }, copies: [],
});
const owners = [{ id: 'o-2', name: 'Alex', userId: 'u-2' }, { id: 'o-1', name: 'Kevin', userId: 'u-1' }];
const locations = [{ id: 'l-1', name: 'Shelf 3', kind: 'physical', collectionId: 'c1', parentLocationId: 'l-0', parent: { id: 'l-0', name: 'Basement' } },
  { id: 'l-0', name: 'Basement', kind: 'physical', collectionId: 'c1', parentLocationId: null, parent: null }];

const signedIn = (kind = 'physical', routes: Record<string, () => Response> = {}) => {
  auth.mockResolvedValue({ user: { id: 'u-1' } });
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input));
    if (routes[url.pathname]) return routes[url.pathname]();
    if (url.pathname.endsWith('/auth/me')) return reply(200, me);
    if (url.pathname.endsWith('/album/a-1')) return reply(200, album(kind));
    if (url.pathname.endsWith('/owner')) return reply(200, owners);
    if (url.pathname.endsWith('/location') && url.searchParams.get('collectionId') === 'c1') return reply(200, locations);
    return reply(404);
  });
};
const html = async (error?: string) => renderToStaticMarkup(await NewCopyPage({
  params: Promise.resolve({ albumId: 'a-1' }),
  searchParams: Promise.resolve(error ? { error } : {}),
}));

describe('/album/[id]/copy/new', () => {
  beforeEach(() => stubAppEnv());
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); auth.mockReset(); });

  it('offers only this collection’s locations, by full path', async () => {
    const fetch = signedIn();
    const out = await html();
    expect(out).toContain('Add a copy of Kind of Blue');
    expect(out).toContain('name="albumId" value="a-1"');
    expect(out).toContain('>Basement → Shelf 3</option>');
    const loc = fetch.mock.calls.map(([u]) => new URL(String(u))).find((u) => u.pathname.endsWith('/location'));
    expect(loc?.searchParams.get('collectionId')).toBe('c1');
  });

  // You usually buy your own records (CLAUDE.md, copy placement).
  it('picks the caller’s own owner row by default', async () => {
    signedIn();
    expect(await html()).toMatch(/<option value="o-1" selected="">Kevin<\/option>/);
  });

  it('asks for condition on a physical collection only', async () => {
    signedIn('physical');
    expect(await html()).toContain('name="condition"');
    vi.restoreAllMocks();
    signedIn('digital');
    expect(await html()).not.toContain('name="condition"');
  });

  it('404s an album the caller can’t see', async () => {
    signedIn('physical', { '/api/album/a-1': () => reply(404) });
    await expect(html()).rejects.toThrow('NOT_FOUND');
  });

  it('explains a refused copy', async () => {
    signedIn();
    expect(await html('invalid')).toMatch(/Pick a location and an owner/);
  });
});
