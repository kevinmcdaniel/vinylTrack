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

const { default: LocationsPage } = await import('./page');

const reply = (status: number, data: unknown = null) =>
  new Response(JSON.stringify({ data, status }), { status, headers: { 'content-type': 'application/json' } });
const me = { id: 'u-1', email: 'kevin@example.com', name: 'Kevin', avatar: null, status: 'active', isAdmin: false };
const collection = { id: 'c1', name: 'Vinyl', kind: 'physical', ownerId: 'u-1', notes: null, albumCount: 2 };
const basement = { id: 'b', name: 'Basement', kind: 'physical', collectionId: 'c1', parentLocationId: null, parent: null };
const shelf = { id: 's', name: 'Shelf 3', kind: 'physical', collectionId: 'c1', parentLocationId: 'b', parent: { id: 'b', name: 'Basement' } };

const signedIn = (routes: Record<string, () => Response> = {}) => {
  auth.mockResolvedValue({ user: { id: 'u-1' } });
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input));
    if (routes[url.pathname]) return routes[url.pathname]();
    if (url.pathname.endsWith('/auth/me')) return reply(200, me);
    if (url.pathname.endsWith('/collection/c1')) return reply(200, collection);
    if (url.pathname.endsWith('/location') && url.searchParams.get('collectionId') === 'c1') return reply(200, [shelf, basement]);
    return reply(404);
  });
};
const html = async (error?: string) => renderToStaticMarkup(await LocationsPage({
  params: Promise.resolve({ collectionId: 'c1' }),
  searchParams: Promise.resolve(error ? { error } : {}),
}));

describe('/collection/[id]/locations', () => {
  beforeEach(() => stubAppEnv());
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); auth.mockReset(); });

  it('lists only this collection’s locations, as paths, with a way back', async () => {
    const fetch = signedIn();
    const out = await html();
    expect(out).toContain('Basement → Shelf 3');
    expect(out).toContain('href="/collection/c1"');
    const locationCall = fetch.mock.calls.map(([u]) => new URL(String(u))).find((u) => u.pathname.endsWith('/location'));
    expect(locationCall?.searchParams.get('collectionId')).toBe('c1');
  });

  it('offers add, edit and delete', async () => {
    signedIn();
    const out = await html();
    expect(out).toContain('Add location');
    expect(out).toMatch(/Edit/);
    expect(out).toContain('aria-label="Delete Basement → Shelf 3"');
  });

  it('defaults a new location’s kind to the collection’s', async () => {
    signedIn();
    expect(await html()).toMatch(/<option value="physical" selected="">/);
  });

  it('404s a collection the caller can’t see', async () => {
    signedIn({ '/api/collection/c1': () => reply(404) });
    await expect(html()).rejects.toThrow('NOT_FOUND');
  });

  it('explains in-use', async () => {
    signedIn();
    expect(await html('in-use')).toMatch(/still has copies or locations inside it/);
  });
});
