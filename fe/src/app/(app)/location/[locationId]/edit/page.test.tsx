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

const { default: EditLocationPage } = await import('./page');

const reply = (status: number, data: unknown = null) =>
  new Response(JSON.stringify({ data, status }), { status, headers: { 'content-type': 'application/json' } });
const me = { id: 'u-1', email: 'kevin@example.com', name: 'Kevin', avatar: null, status: 'active', isAdmin: false };
const basement = { id: 'b', name: 'Basement', kind: 'physical', collectionId: 'c1', parentLocationId: null, parent: null };
const shelf = { id: 's', name: 'Shelf 3', kind: 'physical', collectionId: 'c1', parentLocationId: 'b', parent: { id: 'b', name: 'Basement' } };

const signedIn = () => {
  auth.mockResolvedValue({ user: { id: 'u-1' } });
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/auth/me')) return reply(200, me);
    if (url.pathname.endsWith('/location/s')) return reply(200, shelf);
    if (url.pathname.endsWith('/location') && url.searchParams.get('collectionId') === 'c1') return reply(200, [shelf, basement]);
    return reply(404);
  });
};
const html = async (locationId = 's', query: Record<string, string> = {}) =>
  renderToStaticMarkup(await EditLocationPage({ params: Promise.resolve({ locationId }), searchParams: Promise.resolve(query) }));

// #137: edit and delete moved off the list onto their own page.
describe('/location/[id]/edit', () => {
  beforeEach(() => stubAppEnv());
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); auth.mockReset(); });

  it('edits name, kind and parent, filled in, with a way back to the list', async () => {
    signedIn();
    const out = await html();
    expect(out).toContain('Edit Basement → Shelf 3');
    expect(out).toMatch(/name="name"[^>]*value="Shelf 3"/);
    expect(out).toMatch(/<option value="b" selected="">Basement<\/option>/);
    expect(out).toContain('href="/collection/c1/locations"');
    expect(out).toMatch(/name="collectionId" value="c1"/);
  });

  it('keeps Delete inside a closed <details>', async () => {
    signedIn();
    const out = await html();
    expect(out).toMatch(/<details>(?:(?!<\/details>)[\s\S])*aria-label="Delete Basement → Shelf 3"/);
    expect(out).not.toMatch(/<details[^>]* open/);
  });

  it('explains a refusal', async () => {
    signedIn();
    expect(await html('s', { error: 'in-use' })).toMatch(/still has copies or locations inside it/);
  });

  it('404s a location the caller can’t see', async () => {
    signedIn();
    await expect(html('nope')).rejects.toThrow('NOT_FOUND');
  });
});
