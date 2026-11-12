// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { stubAppEnv } from '@/tests/env';

const auth = vi.fn();
vi.mock('@/auth', () => ({ auth: () => auth() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT ${url}`); }),
  notFound: vi.fn(() => { throw new Error('NOT_FOUND'); }),
  usePathname: () => '/',
}));

const { default: AddCopyPage } = await import('./page');

const reply = (status: number, data: unknown = null) =>
  new Response(JSON.stringify({ data, status }), { status, headers: { 'content-type': 'application/json' } });
const me = { id: 'u-1', email: 'kevin@example.com', name: 'Kevin', avatar: null, status: 'active', isAdmin: false };
const collection = { id: 'c1', name: 'Vinyl', kind: 'physical', albumCount: 3 };
const owners = [{ id: 'o-2', name: 'Alex', userId: 'u-2' }, { id: 'o-1', name: 'Kevin', userId: 'u-1' }];
const locations = [{ id: 'l-0', name: 'Basement', kind: 'physical', collectionId: 'c1', parentLocationId: null, parent: null }];
const albums = [{ id: 'a-1', title: 'Kind of Blue', year: 1959, artists: [{ id: 'ar-1', name: 'Miles Davis' }] }];

const signedIn = () => {
  auth.mockResolvedValue({ user: { id: 'u-1' } });
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/auth/me')) return reply(200, me);
    if (url.pathname.endsWith('/collection/c1')) return reply(200, collection);
    if (url.pathname.endsWith('/owner')) return reply(200, owners);
    if (url.pathname.endsWith('/artist')) return reply(200, [{ id: 'ar-1', name: 'Miles Davis' }]);
    if (url.pathname.endsWith('/location') && url.searchParams.get('collectionId') === 'c1') return reply(200, locations);
    if (url.pathname.endsWith('/album') && url.searchParams.get('collectionId') === 'c1') return reply(200, albums);
    return reply(404);
  });
};
const html = async (collectionId: string, query: Record<string, string> = {}) => renderToStaticMarkup(await AddCopyPage({
  params: Promise.resolve({ collectionId }),
  searchParams: Promise.resolve(query),
}));

// #123: add a copy from the collection page, picking or creating its album.
describe('/collection/[id]/copy/new', () => {
  beforeEach(() => stubAppEnv());
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); auth.mockReset(); });

  it('renders one form: album choice, then this collection’s copy fields, owner defaulting to yours', async () => {
    signedIn();
    const out = await html('c1');
    expect(out).toContain('Add a copy to Vinyl');
    expect(out).toMatch(/<input type="hidden" name="collectionId" value="c1"\/>/);
    expect(out).toContain('name="albumMode"');
    expect(out).toContain('Basement');
    expect(out).toMatch(/<option value="o-1" selected="">Kevin<\/option>/);
  });

  it('has a separate GET form for searching without JS, and asks for nothing until you search', async () => {
    const fetch = signedIn();
    const out = await html('c1');
    expect(out).toMatch(/<form id="album-search" method="get"/);
    expect(fetch.mock.calls.map(([u]) => new URL(String(u)).pathname)).not.toContain('/api/album');
  });

  it('lists matches for ?q= as album choices', async () => {
    const fetch = signedIn();
    const out = await html('c1', { q: 'kind' });
    expect(out).toContain('Kind of Blue · Miles Davis · 1959');
    const search = fetch.mock.calls.map(([u]) => new URL(String(u))).find((u) => u.pathname === '/api/album')!;
    expect(search.searchParams.get('q')).toBe('kind');
  });

  it('reopens on New album after a refused new album', async () => {
    signedIn();
    const out = await html('c1', { error: 'title', mode: 'new' });
    expect(out).toMatch(/name="albumMode" checked="" value="new"/);
    expect(out).toContain('Give the new album a title.');
  });

  it('shows a fixed message for a known error and never echoes an unknown one', async () => {
    signedIn();
    expect(await html('c1', { error: 'pick-album' })).toContain('Pick an album, or switch to New album.');
    const out = await html('c1', { error: '<b>x</b>' });
    expect(out).not.toContain('<b>x</b>');
    expect(out).toContain('Something went wrong');
  });

  it('404s for a collection you cannot see', async () => {
    signedIn();
    await expect(html('nope')).rejects.toThrow('NOT_FOUND');
  });
});
