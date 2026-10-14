import fs from 'fs';
import path from 'path';

/** docs/ is the dev/ops set (hosting runbooks included): admins only (#90). */
export const adminDocsDir = path.join(process.cwd(), 'docs');
/** docs/user/ is the help set any approved user reads at /help (#90). */
export const userDocsDir = path.join(adminDocsDir, 'user');

export type DocNode = { slug: string; label: string };

const readTitle = (filePath: string, fallback: string): string => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const heading = content.match(/^#\s+(.+)$/m);
    return heading ? heading[1].trim() : fallback;
  } catch {
    return fallback;
  }
};

const titleCase = (slug: string) => slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Flat list of `root`/*.md, excluding the README.md index itself. Subfolders
 * are skipped, so docs/user/ never shows up in the admin list.
 */
export function getDocList(root: string): DocNode[] {
  let files: string[];
  try {
    files = fs.readdirSync(root).filter((f) => f.endsWith('.md') && f !== 'README.md');
  } catch {
    return [];
  }

  return files
    .map((f) => {
      const slug = f.replace(/\.md$/, '');
      return { slug, label: readTitle(path.join(root, f), titleCase(slug)) };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Resolves a route slug ([] | ['architecture']) to a markdown file. Only a slug
 * getDocList() returns resolves, so the listing is also the allowlist: nothing
 * from the URL reaches path.join (a decoded `..%2F` would otherwise escape `root`).
 */
export function resolveDocFile(root: string, slug: string[]): string | null {
  if (slug.length === 0) {
    const readme = path.join(root, 'README.md');
    return fs.existsSync(readme) ? readme : null;
  }
  if (slug.length > 1) return null;
  const doc = getDocList(root).find((d) => d.slug === slug[0]);
  return doc ? path.join(root, `${doc.slug}.md`) : null;
}
