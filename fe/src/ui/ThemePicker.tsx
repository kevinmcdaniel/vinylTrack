'use client';

import { setThemeAction } from '@/app/theme/actions';
import { THEMES, THEME_NAMES, type ThemeName } from '@/lib/themes';

/** Theme choice for this device (#18). "System" follows the OS light/dark setting. */
export default function ThemePicker({ current }: { current: ThemeName | null }) {
  return (
    // Keyed on the saved choice: React resets a form after its action, and an
    // uncontrolled select would fall back to the value it first rendered with.
    <form key={current ?? 'system'} action={setThemeAction}>
      <select
        name="theme"
        aria-label="Theme"
        defaultValue={current ?? 'system'}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-md border border-border-strong bg-surface px-1 py-0.5 text-xs text-text-secondary"
      >
        <option value="system">System</option>
        {THEME_NAMES.map((t) => <option key={t} value={t}>{THEMES[t].label}</option>)}
      </select>
    </form>
  );
}
