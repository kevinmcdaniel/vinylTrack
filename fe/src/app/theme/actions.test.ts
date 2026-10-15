// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// The theme picker's server action (#18): one cookie per device, absent = follow the OS.
const store = vi.hoisted(() => ({ set: vi.fn(), delete: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => store }));
vi.mock('@/lib/config', () => ({ getConfig: () => ({ appEnv: 'production' }) }));

const { setThemeAction } = await import('./actions');
const form = (theme: string) => { const f = new FormData(); f.set('theme', theme); return f; };

describe('setThemeAction', () => {
  beforeEach(() => { store.set.mockReset(); store.delete.mockReset(); });

  it.each(['classic', 'warm', 'dark'])('remembers %s for a year', async (theme) => {
    await setThemeAction(form(theme));
    expect(store.set).toHaveBeenCalledWith('vt_theme', theme, {
      httpOnly: true, sameSite: 'lax', secure: true, maxAge: 365 * 24 * 60 * 60, path: '/',
    });
  });

  it('forgets the choice for "system", so the OS decides again', async () => {
    await setThemeAction(form('system'));
    expect(store.delete).toHaveBeenCalledWith('vt_theme');
    expect(store.set).not.toHaveBeenCalled();
  });

  it('ignores and logs anything else, without echoing it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await setThemeAction(form('<script>'));
    expect(store.set).not.toHaveBeenCalled();
    expect(store.delete).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith('theme: ignored unknown theme value');
    warn.mockRestore();
  });
});
