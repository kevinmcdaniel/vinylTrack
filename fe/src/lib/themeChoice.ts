import 'server-only';
import { cookies } from 'next/headers';
import { THEME_COOKIE, parseTheme, type ThemeName } from './themes';

/** This device's theme choice (#18), or null to follow the OS. */
export async function getThemeChoice(): Promise<ThemeName | null> {
  return parseTheme((await cookies()).get(THEME_COOKIE)?.value);
}
