// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

// A docs/ dir next to a .md file outside it: the file traversal would reach.
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docsfs-'));
fs.mkdirSync(path.join(root, 'docs'));
fs.writeFileSync(path.join(root, 'docs', 'README.md'), '# Index');
fs.writeFileSync(path.join(root, 'docs', 'architecture.md'), '# Architecture');
fs.writeFileSync(path.join(root, 'secret.md'), '# Outside');

let resolveDocFile: (slug: string[]) => string | null;
beforeAll(async () => {
  vi.spyOn(process, 'cwd').mockReturnValue(root);
  ({ resolveDocFile } = await import('./docsFs'));
});
afterAll(() => { vi.restoreAllMocks(); fs.rmSync(root, { recursive: true, force: true }); });

// The doc list is the allowlist (#92 review): only a slug it returns resolves.
describe('resolveDocFile', () => {
  it('resolves the index and a listed doc', () => {
    expect(resolveDocFile([])).toBe(path.join(root, 'docs', 'README.md'));
    expect(resolveDocFile(['architecture'])).toBe(path.join(root, 'docs', 'architecture.md'));
  });

  it.each([['../secret'], ['..%2Fsecret'], ['README'], ['missing'], ['architecture', 'extra']])(
    'rejects %s',
    (...slug) => { expect(resolveDocFile(slug.flat())).toBeNull(); },
  );
});
