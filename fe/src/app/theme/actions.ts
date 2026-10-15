'use server';

import { cookies } from 'next/headers';
import { getConfig } from '@/lib/config';
import { THEME_COOKIE, parseTheme } from '@/lib/themes';

// The theme picker (#18). Per device, like the OS setting it overrides; setting
// the cookie re-renders the root layout, which puts it on <html data-theme>.
export async function setThemeAction(formData: FormData) {
  const value = formData.get('theme');
  const store = await cookies();
  if (value === 'system') {
    store.delete(THEME_COOKIE);
    return;
  }
  const theme = parseTheme(typeof value === 'string' ? value : null);
  if (!theme) {
    console.warn('theme: ignored unknown theme value');
    return;
  }
  store.set(THEME_COOKIE, theme, {
    httpOnly: true,
    sameSite: 'lax',
    secure: getConfig().appEnv === 'production',
    maxAge: 365 * 24 * 60 * 60,
    path: '/',
  });
}
