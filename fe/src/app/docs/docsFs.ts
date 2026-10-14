import fs from 'fs';
import path from 'path';

export const docsDir = path.join(process.cwd(), 'docs');

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

/** Flat list of docs (repo root docs/*.md, excluding the README.md index itself). */
export function getDocList(): DocNode[] {
  let files: string[];
  try {
    files = fs.readdirSync(docsDir).filter((f) => f.endsWith('.md') && f !== 'README.md');
  } catch {
    return [];
  }

  return files
    .map((f) => {
      const slug = f.replace(/\.md$/, '');
      return { slug, label: readTitle(path.join(docsDir, f), titleCase(slug)) };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Resolves a route slug ([] | ['architecture']) to a markdown file. Only a slug
 * getDocList() returns resolves, so the listing is also the allowlist: nothing
 * from the URL reaches path.join (a decoded `..%2F` would otherwise escape docs/).
 */
export function resolveDocFile(slug: string[]): string | null {
  if (slug.length === 0) {
    const readme = path.join(docsDir, 'README.md');
    return fs.existsSync(readme) ? readme : null;
  }
  if (slug.length > 1) return null;
  const doc = getDocList().find((d) => d.slug === slug[0]);
  return doc ? path.join(docsDir, `${doc.slug}.md`) : null;
}
