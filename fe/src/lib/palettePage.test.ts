// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { THEMES, THEME_NAMES } from './themes';

// design/palette.html is the visual reference for the themes (#18). Its colors
// live in one JSON block; this keeps that block identical to themes.ts.
const PAGE = path.resolve(import.meta.dirname, '../../../design/palette.html');

describe('design/palette.html', () => {
  it('shows exactly the palettes in themes.ts', () => {
    const html = fs.readFileSync(PAGE, 'utf8');
    const json = html.match(/<script type="application\/json" id="palettes">([\s\S]*?)<\/script>/)?.[1];
    expect(json, 'palettes JSON block').toBeDefined();
    const expected = Object.fromEntries(THEME_NAMES.map((t) => [t, { label: THEMES[t].label, palette: THEMES[t].palette }]));
    expect(JSON.parse(json!)).toEqual(expected);
  });
});
