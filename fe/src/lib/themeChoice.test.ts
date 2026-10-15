// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';

const cookie = vi.hoisted(() => ({ value: undefined as string | undefined }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (name === 'vt_theme' && cookie.value !== undefined ? { value: cookie.value } : undefined) }),
}));

const { getThemeChoice } = await import('./themeChoice');

describe('getThemeChoice', () => {
  it.each([
    [undefined, null],
    ['warm', 'warm'],
    ['dark', 'dark'],
    ['purple', null],
  ])('cookie %s → %s', async (value, expected) => {
    cookie.value = value;
    expect(await getThemeChoice()).toBe(expected);
  });
});
