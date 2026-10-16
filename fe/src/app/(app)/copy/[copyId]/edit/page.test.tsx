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

const { default: EditCopyPage } = await import('./page');

const reply = (status: number, data: unknown = null) =>
  new Response(JSON.stringify({ data, status }), { status, headers: { 'content-type': 'application/json' } });
const me = { id: 'u-1', email: 'kevin@example.com', name: 'Kevin', avatar: null, status: 'active', isAdmin: false };
const location = { id: 'l-1', name: 'Shelf 3', kind: 'physical', collectionId: 'c1', parentLocationId: null, parent: null };
const copy = {
  id: 'cp-1', albumId: 'a-1', locationId: 'l-1', location, ownerId: 'o-2', owner: { id: 'o-2', name: 'Alex' },
  sourceId: null, source: null, dateAcquired: '2024-05-01T00:00:00.000Z', price: '24.99', condition: 'VG+', notes: null,
};
const album = {
  id: 'a-1', collectionId: 'c1', title: 'Kind of Blue', format: 'LP', year: 1959, genre: null, notes: null, coverImageUrl: null,
  artists: [], collection: { id: 'c1', name: 'Vinyl', kind: 'physical' }, copies: [copy],
};

const signedIn = (routes: Record<string, () => Response> = {}) => {
  auth.mockResolvedValue({ user: { id: 'u-1' } });
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input));
    if (routes[url.pathname]) return routes[url.pathname]();
    if (url.pathname.endsWith('/auth/me')) return reply(200, me);
    if (url.pathname.endsWith('/copy/cp-1')) return reply(200, copy);
    if (url.pathname.endsWith('/album/a-1')) return reply(200, album);
    if (url.pathname.endsWith('/owner')) return reply(200, [{ id: 'o-1', name: 'Kevin', userId: 'u-1' }, { id: 'o-2', name: 'Alex', userId: null }]);
    if (url.pathname.endsWith('/location')) return reply(200, [location]);
    return reply(404);
  });
};
const html = async (error?: string) => renderToStaticMarkup(await EditCopyPage({
  params: Promise.resolve({ copyId: 'cp-1' }),
  searchParams: Promise.resolve(error ? { error } : {}),
}));

describe('/copy/[id]/edit', () => {
  beforeEach(() => stubAppEnv());
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); auth.mockReset(); });

  it('prefills the copy as it is, keeping its own owner', async () => {
    signedIn();
    const out = await html();
    expect(out).toMatch(/<option value="o-2" selected="">Alex<\/option>/);
    expect(out).toMatch(/<option value="l-1" selected="">Shelf 3<\/option>/);
    expect(out).toContain('value="2024-05-01"');
    expect(out).toContain('value="24.99"');
    expect(out).toContain('value="VG+"');
  });

  it('keeps delete behind its own disclosure', async () => {
    signedIn();
    expect(await html()).toMatch(/<details[^>]*><summary[^>]*>Delete copy<\/summary>/);
  });

  it('404s a copy the caller can’t see', async () => {
    signedIn({ '/api/copy/cp-1': () => reply(404) });
    await expect(html()).rejects.toThrow('NOT_FOUND');
  });
});
