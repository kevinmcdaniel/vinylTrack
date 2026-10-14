// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { renderToStaticMarkup } from 'react-dom/server';
import { stubAppEnv } from '@/tests/env';
import type * as DocsFs from '@/lib/docsFs';

// A help set inside an admin set: /help must only ever read the inner one.
// vi.mock's factory runs lazily, at the page import below, so plain consts do.
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'help-'));
const dirs = { root, admin: path.join(root, 'docs'), user: path.join(root, 'docs', 'user') };
fs.mkdirSync(dirs.user, { recursive: true });
fs.writeFileSync(path.join(dirs.admin, 'hosting-deploy.md'), '# Releasing and deploying\n\nrunbook');
fs.writeFileSync(path.join(dirs.user, 'README.md'), '# Help\n\nStart here: [Getting started](getting-started.md).');
fs.writeFileSync(path.join(dirs.user, 'getting-started.md'), '# Getting started\n\nSign in.');
fs.writeFileSync(path.join(dirs.user, 'draft.md'), '# Draft\n\nNot linked yet.');
afterAll(() => fs.rmSync(dirs.root, { recursive: true, force: true }));

const auth = vi.fn();
vi.mock('@/auth', () => ({ auth: () => auth() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT ${url}`); }),
  notFound: vi.fn(() => { throw new Error('NOT_FOUND'); }),
}));
vi.mock('@/lib/docsFs', async (importOriginal) => ({
  ...(await importOriginal<typeof DocsFs>()),
  adminDocsDir: dirs.admin,
  userDocsDir: dirs.user,
}));

const { default: HelpPage } = await import('./page');

const reply = (status: number, data: unknown = null) =>
  new Response(JSON.stringify({ data, status }), { status, headers: { 'content-type': 'application/json' } });
const user = { id: 'u-1', email: 'a@example.com', name: null, avatar: null, status: 'active', isAdmin: false };
const signedInAs = (over: Partial<typeof user>) => {
  auth.mockResolvedValue({ user: { id: 'u-1' } });
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply(200, { ...user, ...over }));
};
const open = (...slug: string[]) => HelpPage({ params: Promise.resolve({ slug }) });
const html = async (...slug: string[]) => renderToStaticMarkup(await open(...slug));

// User help (#90): docs/user/, for any approved user. docs/ itself is admin-only.
describe('/help', () => {
  beforeEach(() => stubAppEnv());
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); auth.mockReset(); });

  it('sends a signed-out visitor to sign-in', async () => {
    auth.mockResolvedValue(null);
    await expect(open()).rejects.toThrow('REDIRECT /sign-in');
  });

  it('sends a pending user to the waiting screen', async () => {
    signedInAs({ status: 'pending' });
    await expect(open()).rejects.toThrow('REDIRECT /pending');
  });

  // The index's own links set the reading order, so nothing is auto-listed.
  it('shows the index, its links under /help', async () => {
    signedInAs({});
    const out = await html();
    expect(out).toContain('Start here');
    expect(out).toContain('href="/help/getting-started"');
    expect(out).not.toContain('← Help');
    expect(out).not.toContain('/help/draft');
  });

  it('shows a help page with a way back', async () => {
    signedInAs({});
    const out = await html('getting-started');
    expect(out).toContain('Sign in.');
    expect(out).toContain('← Help');
    expect(out).toContain('href="/help"');
  });

  it('renders for an admin too', async () => {
    signedInAs({ isAdmin: true });
    expect(await html()).toContain('Start here');
  });

  it.each([['hosting-deploy'], ['..%2Fhosting-deploy'], ['../hosting-deploy'], ['missing']])(
    'is a 404 for %s',
    async (slug) => {
      signedInAs({ isAdmin: true });
      await expect(open(slug)).rejects.toThrow('NOT_FOUND');
    },
  );
});
