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

const { default: FoundPage } = await import('./page');

const reply = (status: number, data: unknown = null) =>
  new Response(JSON.stringify({ data, status }), { status, headers: { 'content-type': 'application/json' } });
const me = { id: 'u-1', email: 'kevin@example.com', name: 'Kevin', avatar: null, status: 'active', isAdmin: false };
const vinyl = { id: 'c1', name: 'Vinyl', kind: 'physical', ownerId: 'u-1', notes: null, albumCount: 2 };
const miles = { id: 'miles', name: 'Miles Davis', sortName: null, notes: null };
const trane = { id: 'trane', name: 'John Coltrane', sortName: null, notes: null };
const album = (id: string, title: string, artists = [miles]) => ({
  id, collectionId: 'c1', title, format: null, year: null, genre: null, notes: null, coverImageUrl: null, artists,
});
const albumWant = {
  id: 'w1', collectionId: 'c1', artistId: null, albumId: 'kob', artist: null, album: album('kob', 'Kind of Blue'),
  priority: 'must-have', notes: null,
  matches: [{
    album: { id: 'kob', title: 'Kind of Blue', artists: [{ id: 'miles', name: 'Miles Davis' }] },
    copies: [
      { id: 'cp', owner: { id: 'alex', name: 'Alex' }, location: { id: 's', name: 'Shelf 3', parent: { id: 'b', name: 'Basement' } } },
      { id: 'cp2', owner: { id: 'o-kevin', name: 'Kevin' }, location: { id: 'd', name: 'Den', parent: null } },
    ],
  }],
};
const artistWant = {
  id: 'w2', collectionId: 'c1', artistId: 'trane', albumId: null, artist: trane, album: null, priority: 'nice-to-have', notes: null, matches: [],
};
const shelf = { id: 's', name: 'Shelf 3', kind: 'physical', collectionId: 'c1', parentLocationId: null, parent: null };

const signedIn = (want: unknown = albumWant, collection: unknown = vinyl) => {
  auth.mockResolvedValue({ user: { id: 'u-1' } });
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/auth/me')) return reply(200, me);
    if (url.pathname.endsWith('/want/w1')) return reply(200, want);
    if (url.pathname.endsWith('/want/w2')) return reply(200, artistWant);
    if (url.pathname.endsWith('/collection/c1')) return reply(200, collection);
    if (url.pathname.endsWith('/location') && url.searchParams.get('collectionId') === 'c1') return reply(200, [shelf]);
    if (url.pathname.endsWith('/owner')) return reply(200, [{ id: 'alex', name: 'Alex', userId: null }, { id: 'o-kevin', name: 'Kevin', userId: 'u-1' }]);
    if (url.pathname.endsWith('/album') && url.searchParams.get('artistId') === 'trane') return reply(200, [album('gs', 'Giant Steps', [trane])]);
    return reply(404);
  });
};
const html = async (wantId = 'w1', params: Record<string, string> = {}) =>
  renderToStaticMarkup(await FoundPage({ params: Promise.resolve({ wantId }), searchParams: Promise.resolve(params) }));

describe('/want/[id]/found', () => {
  beforeEach(() => stubAppEnv());
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); auth.mockReset(); });

  it('names the want and warns who already has it, you included', async () => {
    signedIn();
    const out = await html();
    expect(out).toContain('Kind of Blue');
    expect(out).toContain('Alex has one — Basement → Shelf 3');
    expect(out).toContain('You have one — Den');
    expect(out).toContain('href="/wants"');
  });

  it('says so when nobody in the collection has it', async () => {
    signedIn();
    expect(await html('w2')).toMatch(/Nobody in Vinyl has anything by John Coltrane yet/);
  });

  it('asks where it goes and whose it is, defaulting the owner to you', async () => {
    signedIn();
    const out = await html();
    expect(out).toContain('name="id" value="w1"');
    expect(out).toContain('name="locationId"');
    expect(out).toMatch(/<option value="o-kevin" selected="">/);
    expect(out).toContain('name="condition"');
    expect(out).toContain('name="dateAcquired"');
    expect(out).toContain('name="price"');
  });

  it('an album want asks no album questions', async () => {
    signedIn();
    const out = await html();
    expect(out).not.toContain('name="needsAlbum"');
    expect(out).not.toContain('name="newTitle"');
  });

  it('an artist want picks one of their albums here, or names a new one', async () => {
    const fetch = signedIn();
    const out = await html('w2');
    const albums = fetch.mock.calls.map(([u]) => new URL(String(u))).find((u) => u.pathname.endsWith('/album'));
    expect(albums?.searchParams.get('collectionId')).toBe('c1');
    expect(out).toContain('name="needsAlbum" value="1"');
    expect(out).toContain('<option value="gs">Giant Steps</option>');
    expect(out).toContain('name="newTitle"');
    expect(out).toContain('name="year"');
  });

  it('leaves condition out of a digital collection', async () => {
    signedIn(albumWant, { ...vinyl, kind: 'digital' });
    expect(await html()).not.toContain('name="condition"');
  });

  it('404s a want the caller cannot see', async () => {
    signedIn();
    await expect(html('nope')).rejects.toThrow('NOT_FOUND');
  });

  it.each([
    ['not-found', /already marked found/],
    ['both', /not both/],
    ['invalid', /location and an owner/],
  ])('explains ?error=%s', async (error, message) => {
    signedIn();
    expect(await html('w1', { error })).toMatch(message);
  });
});
