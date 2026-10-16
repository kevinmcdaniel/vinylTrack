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

const { default: EditAlbumPage } = await import('./page');

const reply = (status: number, data: unknown = null) =>
  new Response(JSON.stringify({ data, status }), { status, headers: { 'content-type': 'application/json' } });
const me = { id: 'u-1', email: 'kevin@example.com', name: 'Kevin', avatar: null, status: 'active', isAdmin: false };
const album = {
  id: 'a-1', collectionId: 'c1', title: 'Kind of Blue', format: 'LP', year: 1959, genre: 'Jazz', notes: null, coverImageUrl: null,
  artists: [{ id: 'ar-1', name: 'Miles Davis', sortName: null, notes: null }],
  collection: { id: 'c1', name: 'Vinyl', kind: 'physical' }, copies: [],
};
const artists = [{ id: 'ar-1', name: 'Miles Davis', sortName: null, notes: null }, { id: 'ar-2', name: 'Bill Evans', sortName: null, notes: null }];

const signedIn = (routes: Record<string, () => Response> = {}) => {
  auth.mockResolvedValue({ user: { id: 'u-1' } });
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const path = new URL(String(input)).pathname;
    if (routes[path]) return routes[path]();
    if (path.endsWith('/auth/me')) return reply(200, me);
    if (path.endsWith('/album/a-1')) return reply(200, album);
    if (path.endsWith('/artist')) return reply(200, artists);
    return reply(404);
  });
};
const html = async (error?: string) => renderToStaticMarkup(await EditAlbumPage({
  params: Promise.resolve({ albumId: 'a-1' }),
  searchParams: Promise.resolve(error ? { error } : {}),
}));

describe('/album/[id]/edit', () => {
  beforeEach(() => stubAppEnv());
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); auth.mockReset(); });

  it('prefills every field and checks the album’s artists', async () => {
    signedIn();
    const out = await html();
    expect(out).toContain('value="Kind of Blue"');
    expect(out).toContain('value="1959"');
    expect(out).toMatch(/<input type="checkbox" name="artistIds" checked="" value="ar-1"\/>/);
    expect(out).toMatch(/<input type="checkbox" name="artistIds" value="ar-2"\/>/);
  });

  it('keeps delete behind its own disclosure', async () => {
    signedIn();
    expect(await html()).toMatch(/<details[^>]*><summary[^>]*>Delete album<\/summary>/);
  });

  it('404s an album the caller can’t see', async () => {
    signedIn({ '/api/album/a-1': () => reply(404) });
    await expect(html()).rejects.toThrow('NOT_FOUND');
  });

  it('explains why delete was refused', async () => {
    signedIn();
    expect(await html('in-use')).toMatch(/still has copies or want items/);
  });
});
