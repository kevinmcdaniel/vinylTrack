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

const { default: WantsPage } = await import('./page');

const reply = (status: number, data: unknown = null) =>
  new Response(JSON.stringify({ data, status }), { status, headers: { 'content-type': 'application/json' } });
const me = { id: 'u-1', email: 'kevin@example.com', name: 'Kevin', avatar: null, status: 'active', isAdmin: false };
const vinyl = { id: 'c1', name: 'Vinyl', kind: 'physical', ownerId: 'u-1', notes: null, albumCount: 3 };
const calls = { id: 'c2', name: 'Square Dance', kind: 'digital', ownerId: 'u-1', notes: null, albumCount: 1 };
const miles = { id: 'miles', name: 'Miles Davis', sortName: 'Davis, Miles', notes: null };
const album = (id: string, title: string) => ({
  id, collectionId: 'c1', title, format: null, year: null, genre: null, notes: null, coverImageUrl: null, artists: [miles],
});
const kobWant = {
  id: 'w1', collectionId: 'c1', artistId: null, albumId: 'kob', artist: null, album: album('kob', 'Kind of Blue'),
  priority: 'must-have', notes: 'a mono pressing',
  matches: [{
    album: { id: 'kob', title: 'Kind of Blue', artists: [{ id: 'miles', name: 'Miles Davis' }] },
    copies: [{ id: 'cp', owner: { id: 'alex', name: 'Alex' }, location: { id: 's', name: 'Shelf 3', parent: { id: 'b', name: 'Basement' } } }],
  }],
};
const sketchesWant = {
  id: 'w2', collectionId: 'c1', artistId: null, albumId: 'sk', artist: null, album: album('sk', 'Sketches of Spain'),
  priority: 'must-have', notes: null, matches: [],
};
const caller = { id: 'caller', name: 'Some Caller', sortName: null, notes: null };
const callerWant = {
  id: 'w3', collectionId: 'c2', artistId: 'caller', albumId: null, artist: caller, album: null,
  priority: 'nice-to-have', notes: null, matches: [],
};

const signedIn = (wants: unknown[] = [kobWant, sketchesWant, callerWant]) => {
  auth.mockResolvedValue({ user: { id: 'u-1' } });
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/auth/me')) return reply(200, me);
    if (url.pathname.endsWith('/collection')) return reply(200, [vinyl, calls]);
    if (url.pathname.endsWith('/want')) {
      const only = url.searchParams.get('collectionId');
      return reply(200, only ? wants.filter((w) => (w as { collectionId: string }).collectionId === only) : wants);
    }
    return reply(404);
  });
};
const html = async (params: Record<string, string> = {}) =>
  renderToStaticMarkup(await WantsPage({ searchParams: Promise.resolve(params) }));
const wantCall = (fetch: ReturnType<typeof signedIn>) =>
  fetch.mock.calls.map(([u]) => new URL(String(u))).find((u) => u.pathname.endsWith('/want'))!;

describe('/wants', () => {
  beforeEach(() => stubAppEnv());
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); auth.mockReset(); });

  it('asks for matches in one request', async () => {
    const fetch = signedIn();
    await html();
    expect(wantCall(fetch).searchParams.get('includeMatches')).toBe('true');
    expect(wantCall(fetch).searchParams.get('collectionId')).toBeNull();
  });

  it('groups must-have before nice-to-have', async () => {
    signedIn();
    const out = await html();
    expect(out.indexOf('Must-have')).toBeGreaterThan(-1);
    expect(out.indexOf('Must-have')).toBeLessThan(out.indexOf('Nice-to-have'));
    expect(out.indexOf('Kind of Blue')).toBeLessThan(out.indexOf('Anything by Some Caller'));
  });

  it('shows what is wanted, by whom it is, and its notes', async () => {
    signedIn();
    const out = await html();
    expect(out).toContain('Kind of Blue');
    expect(out).toContain('Miles Davis');
    expect(out).toContain('a mono pressing');
  });

  it('says who already has it and where', async () => {
    signedIn();
    expect(await html()).toContain('Alex has one — Basement → Shelf 3');
  });

  // #8 review: never imply more was searched than the collection shared with you.
  it('a miss names the collection it searched', async () => {
    signedIn();
    const out = await html();
    expect(out).toContain('No copies in Vinyl');
    expect(out).toContain('No copies in Square Dance');
  });

  it('filters to one collection through the URL, with links for each', async () => {
    const fetch = signedIn();
    const out = await html({ collectionId: 'c2' });
    expect(wantCall(fetch).searchParams.get('collectionId')).toBe('c2');
    expect(out).not.toContain('Kind of Blue');
    expect(out).toContain('href="/wants"');
    expect(out).toContain('href="/wants?collectionId=c1"');
    expect(out).toMatch(/aria-current="page"[^>]*>Square Dance/);
  });

  it('ignores a collectionId the caller cannot see', async () => {
    const fetch = signedIn();
    await html({ collectionId: 'nope' });
    expect(wantCall(fetch).searchParams.get('collectionId')).toBeNull();
  });

  it('says so when the list is empty', async () => {
    signedIn([]);
    expect(await html()).toContain('Nothing on the want list');
  });
});
