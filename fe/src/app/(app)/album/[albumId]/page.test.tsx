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

const { default: AlbumPage } = await import('./page');

const reply = (status: number, data: unknown = null) =>
  new Response(JSON.stringify({ data, status }), { status, headers: { 'content-type': 'application/json' } });
const me = { id: 'u-1', email: 'kevin@example.com', name: 'Kevin', avatar: null, status: 'active', isAdmin: false };
const album = {
  id: 'a-1', collectionId: 'c1', title: 'Kind of Blue', format: 'LP', year: 1959, genre: 'Jazz', notes: null, coverImageUrl: null,
  artists: [], collection: { id: 'c1', name: 'Vinyl', kind: 'physical' }, copies: [],
};

describe('/album/[id]', () => {
  beforeEach(() => {
    stubAppEnv();
    auth.mockResolvedValue({ user: { id: 'u-1' } });
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith('/auth/me')) return reply(200, me);
      if (path.endsWith('/album/a-1')) return reply(200, album);
      return reply(404);
    });
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); auth.mockReset(); });

  it('links to editing this album', async () => {
    const out = renderToStaticMarkup(await AlbumPage({ params: Promise.resolve({ albumId: 'a-1' }) }));
    expect(out).toContain('href="/album/a-1/edit"');
  });
});
