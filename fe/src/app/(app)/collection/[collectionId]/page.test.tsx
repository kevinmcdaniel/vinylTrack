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
const collections = [{ id: 'c1', name: 'Vinyl', kind: 'physical', ownerId: 'u-1', owner: { id: 'u-1', name: 'Kevin' }, notes: null, albumCount: 0 }];
const viewer = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const listed = vi.hoisted(() => ({ current: [] as unknown[] }));

describe('/collection/[id]', () => {
  beforeEach(() => {
    stubAppEnv();
    viewer.current = {};
    listed.current = collections;
    auth.mockResolvedValue({ user: { id: 'u-1' } });
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith('/auth/me')) return reply(200, { ...me, ...viewer.current });
      if (path.endsWith('/collection')) return reply(200, listed.current);
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

  // #123: you add a copy (picking or creating its album); an album alone is a want.
  it('links to adding a copy here, not an album on its own', async () => {
    const out = renderToStaticMarkup(await CollectionPage({ params: Promise.resolve({ collectionId: 'c1' }), searchParams: Promise.resolve({}) }));
    expect(out).toMatch(/href="\/collection\/c1\/copy\/new"[^>]*>Add copy</);
    expect(out).not.toContain('/album/new');
  });

  // #125: settings (rename, sharing) are the owner's; a member sees whose it is.
  const html = async () => renderToStaticMarkup(await CollectionPage({ params: Promise.resolve({ collectionId: 'c1' }), searchParams: Promise.resolve({}) }));
  const sharedWithMe = [{ ...collections[0], ownerId: 'u-2', owner: { id: 'u-2', name: 'Alex' } }];

  it('links its owner to the collection settings', async () => {
    const out = await html();
    expect(out).toMatch(/href="\/collection\/c1\/settings"[^>]*>Settings</);
    expect(out).not.toContain('Shared by');
  });

  it('tells a member whose collection it is, with no settings link', async () => {
    listed.current = sharedWithMe;
    const out = await html();
    expect(out).toContain('Shared by Alex');
    expect(out).not.toContain('/collection/c1/settings');
  });

  it('links an admin to the settings of a collection they do not own', async () => {
    listed.current = sharedWithMe;
    viewer.current = { isAdmin: true };
    const out = await html();
    expect(out).toContain('href="/collection/c1/settings"');
    // An admin sees every collection, shared with them or not.
    expect(out).toContain('Owned by Alex');
    expect(out).not.toContain('Shared by');
  });
});
