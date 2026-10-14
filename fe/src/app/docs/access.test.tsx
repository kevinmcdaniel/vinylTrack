// @vitest-environment node
// Server-only code: run in Node, not jsdom (jose rejects jsdom's cross-realm Uint8Array).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { stubAppEnv } from '@/tests/env';

const auth = vi.fn();
vi.mock('@/auth', () => ({ auth: () => auth() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT ${url}`); }),
  notFound: vi.fn(() => { throw new Error('NOT_FOUND'); }),
}));
vi.mock('./docsFs', () => ({
  getDocList: () => [{ slug: 'hosting-deploy', label: 'Releasing and deploying' }],
  resolveDocFile: () => import.meta.filename,
}));

const { default: DocPage } = await import('./[[...slug]]/page');
const { default: DocsLayout } = await import('./layout');

const reply = (status: number, data: unknown = null) =>
  new Response(JSON.stringify({ data, status }), { status, headers: { 'content-type': 'application/json' } });
const user = { id: 'u-1', email: 'a@example.com', name: null, avatar: null, status: 'active', isAdmin: false };
const signedInAs = (over: Partial<typeof user>) => {
  auth.mockResolvedValue({ user: { id: 'u-1' } });
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply(200, { ...user, ...over }));
};

const page = () => DocPage({ params: Promise.resolve({ slug: [] }) });
const layout = () => DocsLayout({ children: null });

// docs/ is the dev/ops set (hosting runbooks included): admins only (#90).
// Approved non-admins go to the user help instead.
describe.each([['page', page], ['layout', layout]])('/docs %s', (_name, render) => {
  beforeEach(() => stubAppEnv());
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); auth.mockReset(); });

  it('sends a signed-out visitor to sign-in', async () => {
    auth.mockResolvedValue(null);
    await expect(render()).rejects.toThrow('REDIRECT /sign-in');
  });

  it('sends a pending user to the waiting screen', async () => {
    signedInAs({ status: 'pending' });
    await expect(render()).rejects.toThrow('REDIRECT /pending');
  });

  it('sends an approved non-admin to /help', async () => {
    signedInAs({});
    await expect(render()).rejects.toThrow('REDIRECT /help');
  });

  it('renders for an admin', async () => {
    signedInAs({ isAdmin: true });
    await expect(render()).resolves.toBeTruthy();
  });
});
