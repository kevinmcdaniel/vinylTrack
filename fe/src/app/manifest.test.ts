// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import manifest from './manifest';
import { THEMES } from '@/lib/themes';

const PUBLIC = path.resolve(import.meta.dirname, '../../public');
// PNG IHDR: width and height are big-endian u32s at bytes 16 and 20.
const pngSize = (file: string) => {
  const b = fs.readFileSync(file);
  expect(b.subarray(1, 4).toString()).toBe('PNG');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

// #9: what iOS "Add to Home Screen" and Android's install prompt read.
describe('web app manifest', () => {
  const m = manifest();

  it('opens full-screen on the want list, the store screen', () => {
    expect(m.name).toBe('vinylTrack');
    expect(m.short_name).toBe('vinylTrack');
    expect(m.display).toBe('standalone');
    expect(m.start_url).toBe('/wants');
    expect(m.scope).toBe('/');
  });

  it('takes its colors from the classic theme', () => {
    expect(m.background_color).toBe(THEMES.classic.palette.bg);
    expect(m.theme_color).toBe(THEMES.classic.palette.bg);
  });

  it('lists 192 and 512 icons plus a maskable one, each a real PNG of that size', () => {
    const icons = m.icons ?? [];
    expect(icons.map((i) => [i.sizes, i.purpose ?? 'any'])).toEqual([
      ['192x192', 'any'],
      ['512x512', 'any'],
      ['512x512', 'maskable'],
    ]);
    for (const icon of icons) {
      const [w, h] = pngSize(path.join(PUBLIC, icon.src));
      expect(`${w}x${h}`).toBe(icon.sizes);
      expect(icon.type).toBe('image/png');
    }
  });
});

describe('app icons (file conventions)', () => {
  const APP = import.meta.dirname;
  it.each([['icon.png', 32], ['apple-icon.png', 180]])('%s is a %ipx PNG', (file, size) => {
    expect(pngSize(path.join(APP, file))).toEqual([size, size]);
  });
});
