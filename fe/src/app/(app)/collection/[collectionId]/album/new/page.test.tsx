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

const { default: NewAlbumPage } = await import('./page');

const reply = (status: number, data: unknown = null) =>
  new Response(JSON.stringify({ data, status }), { status, headers: { 'content-type': 'application/json' } });
const me = { id: 'u-1', email: 'kevin@example.com', name: 'Kevin', avatar: null, status: 'active', isAdmin: false };
const collection = { id: 'c1', name: 'Vinyl', kind: 'physical', ownerId: 'u-1', notes: null, albumCount: 0 };
const artists = [{ id: 'ar-1', name: 'Miles Davis', sortName: null, notes: null }];

const signedIn = (routes: Record<string, () => Response> = {}) => {
  auth.mockResolvedValue({ user: { id: 'u-1' } });
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const path = new URL(String(input)).pathname;
    if (routes[path]) return routes[path]();
    if (path.endsWith('/auth/me')) return reply(200, me);
    if (path.endsWith('/collection/c1')) return reply(200, collection);
    if (path.endsWith('/artist')) return reply(200, artists);
    return reply(404);
  });
};
const html = async (error?: string) => renderToStaticMarkup(await NewAlbumPage({
  params: Promise.resolve({ collectionId: 'c1' }),
  searchParams: Promise.resolve(error ? { error } : {}),
}));

describe('/collection/[id]/album/new', () => {
  beforeEach(() => stubAppEnv());
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); auth.mockReset(); });

  it('offers a blank album form for this collection, with every artist to pick', async () => {
    signedIn();
    const out = await html();
    expect(out).toContain('New album in Vinyl');
    expect(out).toContain('name="collectionId" value="c1"');
    expect(out).toContain('Miles Davis');
    expect(out).toContain('Add album');
  });

  it('404s a collection the caller can’t see', async () => {
    signedIn({ '/api/collection/c1': () => reply(404) });
    await expect(html()).rejects.toThrow('NOT_FOUND');
  });

  it('explains a missing title', async () => {
    signedIn();
    expect(await html('invalid')).toMatch(/Give the album a title/);
  });
});
