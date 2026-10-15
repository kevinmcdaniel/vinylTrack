/**
 * Color palettes (#18). The single source for every color token: the root
 * layout renders `themeCss()` into <head>, Tailwind maps each token to a
 * utility (`bg-surface`, `text-text-muted`) and `themes.test.ts` holds every
 * text/background pair to WCAG AA. Values started from the wireframe's
 * THEMES (design/wireframes/VinylTrackApp.dc.html) and were adjusted for
 * contrast; see docs/design-system.md.
 *
 * `classic` is light and `dark` is dark; with no choice made, the OS setting
 * picks between them. `warm` is a light "record store" palette someone has to
 * choose (#18).
 */

export const TOKENS = [
  'bg', 'surface', 'surface-alt', 'border', 'border-light', 'border-strong',
  'text', 'text-secondary', 'text-tertiary', 'text-muted', 'chevron',
  'primary', 'primary-text', 'primary-bg', 'primary-border',
  'accent-purple', 'accent-green', 'on-accent', 'success-bg',
  'warn-bg', 'warn-border', 'warn-text', 'danger-bg', 'danger-text',
] as const;

export type Token = (typeof TOKENS)[number];
export type Palette = Record<Token, string>;

export const THEME_NAMES = ['classic', 'warm', 'dark'] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

export const THEMES: Record<ThemeName, { label: string; scheme: 'light' | 'dark'; palette: Palette }> = {
  classic: {
    label: 'Classic',
    scheme: 'light',
    palette: {
      'bg': '#eef1f4', 'surface': '#ffffff', 'surface-alt': '#f4f7fb',
      'border': '#dbe2e9', 'border-light': '#e1e7ee', 'border-strong': '#cdd6e0',
      'text': '#142031', 'text-secondary': '#3a4856', 'text-tertiary': '#505b69', 'text-muted': '#5f6e7f',
      'chevron': '#aebccb',
      'primary': '#1a60eb', 'primary-text': '#ffffff', 'primary-bg': '#e7eefc', 'primary-border': '#c7d9fb',
      'accent-purple': '#7a52c4', 'accent-green': '#24794c', 'on-accent': '#ffffff', 'success-bg': '#e3f3ea',
      'warn-bg': '#fbf1df', 'warn-border': '#e0a64e', 'warn-text': '#956317',
      'danger-bg': '#fdeceb', 'danger-text': '#b9443b',
    },
  },
  warm: {
    label: 'Warm',
    scheme: 'light',
    palette: {
      'bg': '#f7f1e6', 'surface': '#fffaf2', 'surface-alt': '#f0e6d2',
      'border': '#e3d5bb', 'border-light': '#ecdfc7', 'border-strong': '#d8c7a3',
      'text': '#2c2118', 'text-secondary': '#4f412d', 'text-tertiary': '#605241', 'text-muted': '#71644e',
      'chevron': '#c2ae8a',
      'primary': '#a1472a', 'primary-text': '#ffffff', 'primary-bg': '#f3ded1', 'primary-border': '#e4b79a',
      'accent-purple': '#7d5a8c', 'accent-green': '#546f46', 'on-accent': '#ffffff', 'success-bg': '#e6ecdc',
      'warn-bg': '#f6e3c4', 'warn-border': '#cf9a3e', 'warn-text': '#8a5a12',
      'danger-bg': '#f3ddd6', 'danger-text': '#a8402c',
    },
  },
  dark: {
    label: 'Dark',
    scheme: 'dark',
    palette: {
      'bg': '#14161b', 'surface': '#1d2027', 'surface-alt': '#23262d',
      'border': '#2b2f38', 'border-light': '#262a32', 'border-strong': '#383d47',
      'text': '#eef1f4', 'text-secondary': '#c3c9d4', 'text-tertiary': '#9da5b2', 'text-muted': '#888f9c',
      'chevron': '#565e6b',
      'primary': '#6d99ff', 'primary-text': '#14161b', 'primary-bg': '#223256', 'primary-border': '#33487a',
      'accent-purple': '#a480e0', 'accent-green': '#4fbf82', 'on-accent': '#14161b', 'success-bg': '#1d3327',
      'warn-bg': '#3a2f18', 'warn-border': '#a9761f', 'warn-text': '#e3b767',
      'danger-bg': '#3a2020', 'danger-text': '#e36c5e',
    },
  },
};

/** Cookie holding this device's choice. Absent means "follow the OS". */
export const THEME_COOKIE = 'vt_theme';

export function parseTheme(value: string | undefined | null): ThemeName | null {
  return THEME_NAMES.find((t) => t === value) ?? null;
}

function block(selector: string, name: ThemeName): string {
  const { scheme, palette } = THEMES[name];
  const vars = TOKENS.map((t) => `--${t}:${palette[t]};`).join('');
  return `${selector}{color-scheme:${scheme};${vars}}`;
}

/**
 * CSS for every theme. `<html data-theme="…">` picks one; without the
 * attribute, classic, or dark when the OS asks for it.
 */
export function themeCss(): string {
  return [
    block(':root,[data-theme="classic"]', 'classic'),
    block('[data-theme="warm"]', 'warm'),
    block('[data-theme="dark"]', 'dark'),
    `@media (prefers-color-scheme: dark){${block(':root:not([data-theme])', 'dark')}}`,
  ].join('\n');
}

/** WCAG 2 contrast ratio between two `#rrggbb` colors. */
export function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
