// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { stubAppEnv } from '@/tests/env';

const auth = vi.fn();
vi.mock('@/auth', () => ({ auth: () => auth() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT ${url}`); }),
  notFound: vi.fn(() => { throw new Error('NOT_FOUND'); }),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/collection/c1',
  useSearchParams: () => new URLSearchParams(),
}));

const { default: CollectionPage } = await import('./page');

const reply = (status: number, data: unknown = null) =>
  new Response(JSON.stringify({ data, status }), { status, headers: { 'content-type': 'application/json' } });
const me = { id: 'u-1', email: 'kevin@example.com', name: 'Kevin', avatar: null, status: 'active', isAdmin: false };
const collections = [{ id: 'c1', name: 'Vinyl', kind: 'physical', ownerId: 'u-1', notes: null, albumCount: 0 }];

describe('/collection/[id]', () => {
  beforeEach(() => {
    stubAppEnv();
    auth.mockResolvedValue({ user: { id: 'u-1' } });
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith('/auth/me')) return reply(200, me);
      if (path.endsWith('/collection')) return reply(200, collections);
      if (path.endsWith('/album')) return reply(200, []);
      return reply(404);
    });
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); auth.mockReset(); });

  // #102: a copy needs a location, so this collection's are one tap away.
  it('links to this collection’s locations', async () => {
    const out = renderToStaticMarkup(await CollectionPage({ params: Promise.resolve({ collectionId: 'c1' }), searchParams: Promise.resolve({}) }));
    expect(out).toContain('href="/collection/c1/locations"');
  });

  it('links to adding an album here', async () => {
    const out = renderToStaticMarkup(await CollectionPage({ params: Promise.resolve({ collectionId: 'c1' }), searchParams: Promise.resolve({}) }));
    expect(out).toContain('href="/collection/c1/album/new"');
  });
});
