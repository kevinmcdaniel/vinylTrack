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

/** Resolves a route slug ([] | ['architecture']) to a markdown file. Flat structure, no subfolders. */
export function resolveDocFile(slug: string[]): string | null {
  if (slug.length === 0) {
    const readme = path.join(docsDir, 'README.md');
    return fs.existsSync(readme) ? readme : null;
  }
  if (slug.length > 1) return null;
  const file = path.join(docsDir, `${slug[0]}.md`);
  return fs.existsSync(file) ? file : null;
}

/** Every resolvable slug, for generateStaticParams. */
export function getAllDocSlugs(): string[][] {
  return [[], ...getDocList().map((doc) => [doc.slug])];
}
