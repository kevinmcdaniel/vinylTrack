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

const { default: LocationPage } = await import('./page');

const reply = (status: number, data: unknown = null) =>
  new Response(JSON.stringify({ data, status }), { status, headers: { 'content-type': 'application/json' } });
const me = { id: 'u-1', email: 'kevin@example.com', name: 'Kevin', avatar: null, status: 'active', isAdmin: false };
const basement = { id: 'b', name: 'Basement', kind: 'physical', collectionId: 'c1', parentLocationId: null, parent: null };
const shelf = { id: 's', name: 'Shelf 3', kind: 'physical', collectionId: 'c1', parentLocationId: 'b', parent: { id: 'b', name: 'Basement' } };

const signedIn = (copies: unknown[] = []) => {
  auth.mockResolvedValue({ user: { id: 'u-1' } });
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/auth/me')) return reply(200, me);
    if (url.pathname.endsWith('/location/s')) return reply(200, shelf);
    if (url.pathname.endsWith('/location') && url.searchParams.get('collectionId') === 'c1') return reply(200, [basement, shelf]);
    if (url.pathname.endsWith('/copy')) return reply(200, copies);
    return reply(404);
  });
};
const html = (id: string) => LocationPage({ params: Promise.resolve({ locationId: id }) }).then(renderToStaticMarkup);

// #126: open a location, see what's in it and in everything inside it.
describe('/location/[id]', () => {
  beforeEach(() => stubAppEnv());
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); auth.mockReset(); });

  it('titles the page with the full path and asks for its copies, sub-locations included', async () => {
    const fetch = signedIn();
    const out = await html('s');
    expect(out).toContain('Basement → Shelf 3');
    expect(out).toContain('href="/collection/c1/locations"');
    const call = fetch.mock.calls.map(([u]) => new URL(String(u))).find((u) => u.pathname === '/api/copy')!;
    expect(call.searchParams.get('locationId')).toBe('s');
    expect(call.searchParams.get('includeSublocations')).toBe('true');
  });

  // #137: edit lives on its own page; reach it from here too.
  it('links to its edit page', async () => {
    signedIn();
    expect(await html('s')).toContain('href="/location/s/edit"');
  });

  it('404s for a location you cannot see', async () => {
    signedIn();
    await expect(html('nope')).rejects.toThrow('NOT_FOUND');
  });
});
