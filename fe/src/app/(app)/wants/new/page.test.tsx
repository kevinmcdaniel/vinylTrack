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
}));

const { default: NewWantPage } = await import('./page');

const reply = (status: number, data: unknown = null) =>
  new Response(JSON.stringify({ data, status }), { status, headers: { 'content-type': 'application/json' } });
const me = { id: 'u-1', email: 'kevin@example.com', name: 'Kevin', avatar: null, status: 'active', isAdmin: false };
const vinyl = { id: 'c1', name: 'Vinyl', kind: 'physical', ownerId: 'u-1', notes: null, albumCount: 1 };
const calls = { id: 'c2', name: 'Square Dance', kind: 'digital', ownerId: 'u-1', notes: null, albumCount: 0 };
const miles = { id: 'miles', name: 'Miles Davis', sortName: null, notes: null };
const kob = { id: 'kob', collectionId: 'c1', title: 'Kind of Blue', format: null, year: null, genre: null, notes: null, coverImageUrl: null, artists: [miles] };

const signedIn = (collections = [vinyl, calls]) => {
  auth.mockResolvedValue({ user: { id: 'u-1' } });
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/auth/me')) return reply(200, me);
    if (url.pathname.endsWith('/collection')) return reply(200, collections);
    if (url.pathname.endsWith('/artist')) return reply(200, [miles]);
    if (url.pathname.endsWith('/album')) return reply(200, url.searchParams.get('collectionId') === 'c1' ? [kob] : []);
    return reply(404);
  });
};
const html = async (params: Record<string, string> = {}) =>
  renderToStaticMarkup(await NewWantPage({ searchParams: Promise.resolve(params) }));
const albumCall = (fetch: ReturnType<typeof signedIn>) =>
  fetch.mock.calls.map(([u]) => new URL(String(u))).find((u) => u.pathname.endsWith('/album'));

describe('/wants/new', () => {
  beforeEach(() => stubAppEnv());
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); auth.mockReset(); });

  it('defaults to the first collection and offers only its albums', async () => {
    const fetch = signedIn();
    const out = await html();
    expect(albumCall(fetch)?.searchParams.get('collectionId')).toBe('c1');
    expect(out).toContain('name="collectionId" value="c1"');
    expect(out).toContain('Kind of Blue — Miles Davis');
  });

  it('switches collection through the URL', async () => {
    const fetch = signedIn();
    const out = await html({ collectionId: 'c2' });
    expect(albumCall(fetch)?.searchParams.get('collectionId')).toBe('c2');
    expect(out).toContain('href="/wants/new?collectionId=c1"');
    expect(out).toMatch(/aria-current="page"[^>]*>Square Dance/);
  });

  it('offers album or artist, both priorities, a new title, a new artist and notes', async () => {
    signedIn();
    const out = await html();
    expect(out).toMatch(/name="kind" checked="" value="album"/);
    expect(out).toContain('name="kind" value="artist"');
    expect(out).toContain('name="priority" value="must-have"');
    expect(out).toMatch(/name="priority" checked="" value="nice-to-have"/);
    expect(out).toContain('name="newTitle"');
    expect(out).toContain('name="artistIds"');
    expect(out).toContain('name="artistId"');
    expect(out).toContain('name="newArtist"');
    expect(out).toContain('name="notes"');
  });

  // From an album page's "Add to want list".
  it('preselects an album passed in the URL', async () => {
    signedIn();
    expect(await html({ collectionId: 'c1', albumId: 'kob' })).toMatch(/<option value="kob" selected="">/);
  });

  // After a refused want, the artist just created stays picked (PR #118 review).
  it('preselects an artist passed in the URL, on the artist half', async () => {
    signedIn();
    const out = await html({ collectionId: 'c1', artistId: 'miles' });
    expect(out).toMatch(/name="kind" checked="" value="artist"/);
    expect(out).toMatch(/name="artistId"[^>]*>(?:(?!<\/select>).)*<option value="miles" selected="">/);
  });

  it('ignores a collection the caller cannot see', async () => {
    const fetch = signedIn();
    await html({ collectionId: 'nope' });
    expect(albumCall(fetch)?.searchParams.get('collectionId')).toBe('c1');
  });

  it('points to creating a collection when there is none', async () => {
    signedIn([]);
    const out = await html();
    expect(out).toContain('href="/collection/new"');
    expect(out).not.toContain('name="kind"');
  });

  it.each([
    ['invalid', /Pick an album or an artist, or name a new one/],
    ['forbidden', /can’t add to that collection/],
    ['both', /not both/],
  ])('explains ?error=%s', async (error, message) => {
    signedIn();
    expect(await html({ error })).toMatch(message);
  });
});
