// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Colors come from the theme tokens (#18, src/lib/themes.ts): `bg-surface`,
 * `text-text-muted`, … Raw Tailwind palette colors (`black/10`, `red-500`) and
 * arbitrary `[var(--…)]` / `[#hex]` values skip the themes and their contrast
 * test, so new code may not use them.
 *
 * LEGACY lists the files written before the tokens existed. Each restyle
 * removes its files from the list; the second test fails if a cleaned-up file
 * is left on it, so the list only shrinks. #18 closes when it is empty.
 */
const LEGACY = [
  'app/(app)/artist/[artistId]/page.tsx',
  'app/(app)/layout.tsx',
  'app/(app)/loading.tsx',
  'app/docs/layout.tsx',
  'ui/AlbumCard.tsx',
  'ui/CollectionSwitcher.tsx',
  'ui/CopyRow.tsx',
  'ui/EmptyState.tsx',
  'ui/FilterBar.tsx',
  'ui/NewCollectionForm.tsx',
  'ui/PendingView.tsx',
  'ui/RequestsList.tsx',
  'ui/SignInForms.tsx',
];

const PALETTE = 'black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const RAW_COLOR = new RegExp(
  `\\b(?:bg|text|border|ring|divide|from|to|via|outline|fill|stroke|placeholder|decoration|shadow)-(?:${PALETTE})\\b|-\\[(?:var\\(--|#)`,
);

const SRC = path.resolve(import.meta.dirname, '..');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [path.relative(SRC, full)] : [];
  });
}

const offenders = ['app', 'ui']
  .flatMap((d) => sourceFiles(path.join(SRC, d)))
  .filter((f) => RAW_COLOR.test(fs.readFileSync(path.join(SRC, f), 'utf8')))
  .sort();

describe('color tokens', () => {
  it('no file outside LEGACY uses raw palette colors or arbitrary color values', () => {
    expect(offenders.filter((f) => !LEGACY.includes(f))).toEqual([]);
  });

  it('every LEGACY file still needs its entry (remove it once restyled)', () => {
    expect(LEGACY.filter((f) => !offenders.includes(f))).toEqual([]);
  });

  it('catches the patterns it is meant to', () => {
    for (const bad of ['border-black/10', 'dark:bg-white/10', 'text-red-500', 'bg-[var(--x)]', 'text-[#fff]']) {
      expect(RAW_COLOR.test(`className="${bad}"`), bad).toBe(true);
    }
    for (const ok of ['bg-surface', 'text-text-muted', 'border-border-strong', 'bg-primary-bg', 'text-on-accent']) {
      expect(RAW_COLOR.test(`className="${ok}"`), ok).toBe(false);
    }
  });
});
