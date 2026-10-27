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

const { default: Home } = await import('./page');

const reply = (status: number, data: unknown = null) =>
  new Response(JSON.stringify({ data, status }), { status, headers: { 'content-type': 'application/json' } });
const me = { id: 'u-1', email: 'a@example.com', name: null, avatar: null, status: 'active', isAdmin: true };

const withCollections = (collections: unknown[]) => {
  auth.mockResolvedValue({ user: { id: 'u-1' } });
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith('/auth/me')) return reply(200, me);
    if (path.endsWith('/collection')) return reply(200, collections);
    return reply(404);
  });
};

describe('/', () => {
  beforeEach(() => stubAppEnv());
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); auth.mockReset(); });

  it('opens the first collection', async () => {
    withCollections([{ id: 'c-1', name: 'Vinyl' }]);
    await expect(Home()).rejects.toThrow('REDIRECT /collection/c-1');
  });

  // #124: "shared with you" read wrong to an admin and to anyone who can start one.
  it('offers to start a collection when there are none', async () => {
    withCollections([]);
    const out = renderToStaticMarkup(await Home());
    expect(out).toContain('No collections yet.');
    expect(out).not.toContain('shared with you yet');
    expect(out).toContain('href="/collection/new"');
  });
});
