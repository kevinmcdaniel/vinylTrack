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

const { default: EditOwnerPage } = await import('./page');

const reply = (status: number, data: unknown = null) =>
  new Response(JSON.stringify({ data, status }), { status, headers: { 'content-type': 'application/json' } });
const me = { id: 'u-1', email: 'kevin@example.com', name: 'Kevin', avatar: null, status: 'active', isAdmin: false };

const signedInAs = (over: Partial<typeof me> = {}) => {
  auth.mockResolvedValue({ user: { id: 'u-1' } });
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith('/auth/me')) return reply(200, { ...me, ...over });
    if (path.endsWith('/owner/o-2')) return reply(200, { id: 'o-2', name: 'Grandma Ruth', userId: null });
    return reply(404);
  });
};
const html = async (ownerId = 'o-2', query: Record<string, string> = {}) =>
  renderToStaticMarkup(await EditOwnerPage({ params: Promise.resolve({ ownerId }), searchParams: Promise.resolve(query) }));

// #137: rename and delete moved off the list onto their own page.
describe('/owners/[id]/edit', () => {
  beforeEach(() => stubAppEnv());
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); auth.mockReset(); });

  it('renames, filled in with the current name, and links back to the list', async () => {
    signedInAs();
    const out = await html();
    expect(out).toContain('Edit Grandma Ruth');
    expect(out).toMatch(/name="name"[^>]*value="Grandma Ruth"/);
    expect(out).toContain('href="/owners"');
    expect(out).not.toMatch(/>Delete</);
  });

  it('keeps an admin’s Delete inside a closed <details>', async () => {
    signedInAs({ isAdmin: true });
    const out = await html();
    expect(out).toMatch(/<details>(?:(?!<\/details>)[\s\S])*>Delete<\/button>/);
    expect(out).not.toMatch(/<details[^>]* open/);
  });

  it('explains a refusal from its own form', async () => {
    signedInAs({ isAdmin: true });
    expect(await html('o-2', { error: 'in-use' })).toMatch(/still owns copies/);
  });

  it('404s for an owner that does not exist', async () => {
    signedInAs();
    await expect(html('o-x')).rejects.toThrow('NOT_FOUND');
  });
});
