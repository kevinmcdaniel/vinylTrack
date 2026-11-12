// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { THEMES } from '@/lib/themes';

vi.mock('@/lib/themeChoice', () => ({ getThemeChoice: vi.fn(async () => null) }));
const { metadata, viewport } = await import('./layout');

// #9: iOS reads these from the page, not from the manifest.
describe('root layout metadata', () => {
  it('lets iOS open it full-screen from the home screen, under its own name', () => {
    expect(metadata.appleWebApp).toEqual({ capable: true, title: 'vinylTrack', statusBarStyle: 'default' });
  });

  it('colors the browser chrome to match light and dark', () => {
    expect(viewport.themeColor).toEqual([
      { media: '(prefers-color-scheme: light)', color: THEMES.classic.palette.bg },
      { media: '(prefers-color-scheme: dark)', color: THEMES.dark.palette.bg },
    ]);
  });
});
