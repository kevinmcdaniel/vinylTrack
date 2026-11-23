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

const { default: SettingsPage } = await import('./page');

const reply = (status: number, data: unknown = null) =>
  new Response(JSON.stringify({ data, status }), { status, headers: { 'content-type': 'application/json' } });
const me = { id: 'u-1', email: 'kevin@example.com', name: 'Kevin', avatar: null, status: 'active', isAdmin: false };
const collection = { id: 'c1', name: 'Vinyl', kind: 'physical', ownerId: 'u-1', owner: { id: 'u-1', name: 'Kevin' }, notes: null, albumCount: 0 };

const signedIn = (over: { me?: object; collection?: object } = {}) => {
  auth.mockResolvedValue({ user: { id: 'u-1' } });
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith('/auth/me')) return reply(200, { ...me, ...over.me });
    if (path.endsWith('/collection/c1')) return reply(200, { ...collection, ...over.collection });
    if (path.endsWith('/collection/c1/share')) return reply(200, [{ id: 'u-2', name: 'Alex', email: 'alex@example.com' }]);
    if (path.endsWith('/collection/c1/share/candidates')) return reply(200, [{ id: 'u-3', name: 'Ruth', email: 'ruth@example.com' }]);
    return reply(404);
  });
};
const html = async (query: Record<string, string> = {}) =>
  renderToStaticMarkup(await SettingsPage({ params: Promise.resolve({ collectionId: 'c1' }), searchParams: Promise.resolve(query) }));

// #125: owner or admin only; anyone else sees no hint the page exists.
describe('/collection/[id]/settings', () => {
  beforeEach(() => stubAppEnv());
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); auth.mockReset(); });

  it('shows its owner the rename form and who it is shared with', async () => {
    signedIn();
    const out = await html();
    expect(out).toContain('Vinyl settings');
    expect(out).toContain('alex@example.com');
    expect(out).toContain('Ruth (ruth@example.com)');
  });

  it('lets an admin in to a collection they do not own', async () => {
    signedIn({ me: { isAdmin: true }, collection: { ownerId: 'u-2' } });
    expect(await html()).toContain('Vinyl settings');
  });

  it('404s for a member it is shared with, asking nothing about shares', async () => {
    const fetch = signedIn({ collection: { ownerId: 'u-2' } });
    await expect(html()).rejects.toThrow('NOT_FOUND');
    expect(fetch.mock.calls.map(([u]) => new URL(String(u)).pathname)).not.toContain('/api/collection/c1/share');
  });

  it('passes ?saved and ?error through', async () => {
    signedIn();
    expect(await html({ saved: 'rename' })).toContain('Saved.');
  });
});
