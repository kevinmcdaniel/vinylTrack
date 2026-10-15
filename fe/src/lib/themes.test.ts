import { describe, it, expect } from 'vitest';
import { THEMES, THEME_NAMES, TOKENS, contrast, parseTheme, themeCss, type Token } from './themes';

/**
 * Every text color the design puts on a background (docs/design-system.md),
 * held to WCAG AA for normal text: 4.5:1. All of the app's text is small
 * (10–15px), so no pair gets the 3:1 large-text allowance. `chevron` is left
 * out on purpose: it only marks disabled controls, which WCAG exempts.
 */
const PAIRS: Array<[fg: Token, bg: Token, use: string]> = [
  ['text', 'bg', 'body text'],
  ['text', 'surface', 'card text'],
  ['text', 'surface-alt', 'search field text'],
  ['text-secondary', 'surface', 'inactive chip, secondary button'],
  ['text-secondary', 'bg', 'inactive tab'],
  ['text-tertiary', 'bg', 'nice-to-have priority tag'],
  ['text-tertiary', 'surface', 'credit keys'],
  ['text-tertiary', 'surface-alt', 'want check: not found'],
  ['text-muted', 'bg', 'eyebrow, condition "—" tag'],
  ['text-muted', 'surface', 'metadata line in a card'],
  ['text-muted', 'surface-alt', 'metadata in an inset row'],
  ['primary-text', 'primary', 'primary button, avatar initial on primary'],
  ['primary', 'surface', 'link, outline button'],
  ['primary', 'bg', 'link on the page'],
  ['primary', 'primary-bg', 'active chip/tab, VG+ tag, info note'],
  ['on-accent', 'accent-green', 'avatar initial, confirm button'],
  ['on-accent', 'accent-purple', 'avatar initial'],
  ['on-accent', 'text-tertiary', 'fallback avatar initial'],
  ['accent-green', 'success-bg', 'NM tag, success result'],
  ['warn-text', 'warn-bg', 'VG tag, warning banner'],
  ['danger-text', 'danger-bg', 'must-have tag'],
  ['danger-text', 'surface', 'form error'],
];

describe('themes', () => {
  describe.each(THEME_NAMES)('%s', (name) => {
    const palette = THEMES[name].palette;

    it('defines every token as #rrggbb', () => {
      for (const t of TOKENS) expect(palette[t], t).toMatch(/^#[0-9a-f]{6}$/);
    });

    it.each(PAIRS)('%s on %s (%s) meets 4.5:1', (fg, bg) => {
      expect(contrast(palette[fg], palette[bg])).toBeGreaterThanOrEqual(4.5);
    });
  });

  it('computes WCAG contrast', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#ffffff', '#ffffff')).toBe(1);
    expect(contrast('#ffffff', '#2f6fed')).toBeCloseTo(4.55, 2);
  });

  it('accepts only known theme names', () => {
    expect(parseTheme('warm')).toBe('warm');
    expect(parseTheme('system')).toBeNull();
    expect(parseTheme('')).toBeNull();
    expect(parseTheme(undefined)).toBeNull();
  });

  it('renders classic by default, dark when the OS asks, and each theme by attribute', () => {
    const css = themeCss();
    expect(css).toContain(`:root,[data-theme="classic"]{color-scheme:light;--bg:${THEMES.classic.palette.bg};`);
    expect(css).toContain(`[data-theme="warm"]{color-scheme:light;--bg:${THEMES.warm.palette.bg};`);
    expect(css).toContain(`[data-theme="dark"]{color-scheme:dark;--bg:${THEMES.dark.palette.bg};`);
    expect(css).toContain(`@media (prefers-color-scheme: dark){:root:not([data-theme]){color-scheme:dark;--bg:${THEMES.dark.palette.bg};`);
  });
});
