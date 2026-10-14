// @vitest-environment node
import { describe, it, expect, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getDocList, resolveDocFile } from './docsFs';

// docs/ (admin) holds docs/user/ (help), next to a .md file outside both: the
// file traversal would reach.
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docsfs-'));
const admin = path.join(root, 'docs');
const user = path.join(admin, 'user');
fs.mkdirSync(user, { recursive: true });
fs.writeFileSync(path.join(admin, 'README.md'), '# Index');
fs.writeFileSync(path.join(admin, 'architecture.md'), '# Architecture');
fs.writeFileSync(path.join(admin, 'hosting-deploy.md'), 'no heading');
fs.writeFileSync(path.join(user, 'README.md'), '# Help');
fs.writeFileSync(path.join(user, 'getting-started.md'), '# Getting started');
fs.writeFileSync(path.join(root, 'secret.md'), '# Outside');
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe('getDocList', () => {
  it('lists one dir, titled by first heading, without its README', () => {
    expect(getDocList(admin)).toEqual([
      { slug: 'architecture', label: 'Architecture' },
      { slug: 'hosting-deploy', label: 'Hosting Deploy' },
    ]);
  });

  // docs/user/ is the help set (#90): it must not show up in the admin list.
  it('skips subfolders', () => {
    expect(getDocList(admin).map((d) => d.slug)).not.toContain('user');
    expect(getDocList(user)).toEqual([{ slug: 'getting-started', label: 'Getting started' }]);
  });

  it('is empty for a missing dir', () => {
    expect(getDocList(path.join(root, 'nope'))).toEqual([]);
  });
});

// The doc list is the allowlist (#92 review): only a slug it returns resolves.
describe('resolveDocFile', () => {
  it('resolves the index and a listed doc', () => {
    expect(resolveDocFile(admin, [])).toBe(path.join(admin, 'README.md'));
    expect(resolveDocFile(admin, ['architecture'])).toBe(path.join(admin, 'architecture.md'));
    expect(resolveDocFile(user, [])).toBe(path.join(user, 'README.md'));
    expect(resolveDocFile(user, ['getting-started'])).toBe(path.join(user, 'getting-started.md'));
  });

  it.each([
    [admin, ['../secret']], [admin, ['..%2Fsecret']], [admin, ['README']], [admin, ['missing']],
    [admin, ['architecture', 'extra']], [admin, ['user', 'getting-started']], [admin, ['user']],
    [user, ['../architecture']], [user, ['..%2Farchitecture']], [user, ['architecture']],
  ])('rejects %s %j', (dir, slug) => {
    expect(resolveDocFile(dir, slug)).toBeNull();
  });
});
