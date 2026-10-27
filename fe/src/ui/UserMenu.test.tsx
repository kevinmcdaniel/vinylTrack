import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';

const user = vi.hoisted(() => ({ current: { id: 'u-1', email: 'kevin@example.com', name: 'Kevin', avatar: null, status: 'active', isAdmin: false } }));
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn(async () => user.current) }));
vi.mock('@/app/pending/actions', () => ({ signOutAction: vi.fn() }));
vi.mock('@/app/theme/actions', () => ({ setThemeAction: vi.fn() }));
vi.mock('@/lib/themeChoice', () => ({ getThemeChoice: vi.fn(async () => 'warm') }));
vi.mock('@/lib/config', () => ({ getConfig: () => ({ version: 'v0.6.1', publicHostname: 'vinyl.example.org' }) }));
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
const apiGet = vi.hoisted(() => vi.fn());
const { ApiError } = vi.hoisted(() => ({
  ApiError: class ApiError extends Error {
    constructor(readonly status: number, message: string) { super(message); }
  },
}));
vi.mock('@/lib/api', () => ({ apiGet, ApiError }));

import UserMenu from './UserMenu';

const routes = (summary: unknown, owners: unknown = []) =>
  apiGet.mockReset().mockImplementation(async (path: string) => {
    if (path === '/admin/summary') return summary instanceof Error ? Promise.reject(summary) : summary;
    if (path === '/owner') return owners instanceof Error ? Promise.reject(owners) : owners;
    throw new Error(`unexpected ${path}`);
  });
// Menu items sit inside a closed <details>, which the a11y tree treats as hidden.
const link = (name: string | RegExp) => screen.getByRole('link', { name, hidden: true });
const menu = () => screen.getByRole('navigation').querySelector('details')!;

describe('UserMenu', () => {
  beforeEach(() => {
    user.current = { ...user.current, name: 'Kevin', isAdmin: false };
    routes({ pendingUsers: 0, unlinkedOwners: 0 });
  });

  // #124: the header shows a name; the menu says which account that is.
  it('shows the name in the header and the email, role and sign-out inside the menu', async () => {
    render(await UserMenu());
    const summary = menu().querySelector('summary')!;
    expect(summary).toHaveTextContent('Kevin');
    expect(summary).not.toHaveTextContent('kevin@example.com');
    expect(menu()).toHaveTextContent('kevin@example.com');
    expect(menu()).toHaveTextContent('Member');
    expect(within(menu()).getByRole('button', { name: 'Sign out', hidden: true })).toBeInTheDocument();
    expect(menu().open).toBe(false);
  });

  it('falls back to the email when there is no name', async () => {
    user.current = { ...user.current, name: null } as unknown as typeof user.current;
    render(await UserMenu());
    expect(menu().querySelector('summary')).toHaveTextContent('kevin@example.com');
  });

  it('names the owner the account is linked to', async () => {
    routes({ pendingUsers: 0, unlinkedOwners: 0 }, [{ id: 'o-1', name: 'Dad', userId: 'u-1' }, { id: 'o-2', name: 'Ruth', userId: null }]);
    render(await UserMenu());
    expect(menu()).toHaveTextContent('Owns records as Dad');
  });

  it('says nothing about an owner when none is linked, or the lookup fails', async () => {
    routes({ pendingUsers: 0, unlinkedOwners: 0 }, new ApiError(500, 'down'));
    render(await UserMenu());
    expect(menu()).not.toHaveTextContent('Owns records as');
  });

  // #8: the want list is the screen you open in a store, so it stays in the header.
  it.each([[false], [true]])('keeps Want list in the header, first (admin: %s)', async (isAdmin) => {
    user.current = { ...user.current, isAdmin };
    render(await UserMenu());
    const wants = screen.getByRole('link', { name: 'Want list' });
    expect(wants).toHaveAttribute('href', '/wants');
    expect(menu()).not.toContainElement(wants);
    expect(screen.getAllByRole('link', { hidden: true })[0]).toBe(wants);
  });

  it.each([
    ['New collection', '/collection/new'],
    ['Owners', '/owners'],
    ['Help', '/help'],
  ])('puts %s in the menu for everyone', async (name, href) => {
    for (const isAdmin of [false, true]) {
      user.current = { ...user.current, isAdmin };
      const { unmount } = render(await UserMenu());
      expect(link(name)).toHaveAttribute('href', href);
      expect(menu()).toContainElement(link(name));
      unmount();
    }
  });

  it('lets anyone pick a theme from the menu, showing this device\'s choice', async () => {
    render(await UserMenu());
    expect(within(menu()).getByRole('combobox', { name: 'Theme', hidden: true })).toHaveValue('warm');
  });

  // Back office (#90): non-admins see no admin section and pay for no summary.
  it('shows a non-admin no admin section, no version, and asks for no summary', async () => {
    render(await UserMenu());
    expect(screen.queryByRole('link', { name: /admin|users|requests/i, hidden: true })).not.toBeInTheDocument();
    expect(menu()).not.toHaveTextContent('v0.6.1');
    expect(apiGet).not.toHaveBeenCalledWith('/admin/summary');
  });

  it('gives an admin an admin section, with the role, version and host', async () => {
    user.current = { ...user.current, isAdmin: true };
    render(await UserMenu());
    expect(link('Admin')).toHaveAttribute('href', '/admin');
    expect(link('Users')).toHaveAttribute('href', '/admin/users');
    expect(link(/^Access requests/)).toHaveAttribute('href', '/admin/requests');
    expect(menu()).toHaveTextContent('Admin');
    expect(menu()).toHaveTextContent('v0.6.1 · vinyl.example.org');
    expect(menu().querySelector('summary')).not.toHaveTextContent('pending');
  });

  it('badges both the menu button and Access requests with the pending count', async () => {
    user.current = { ...user.current, isAdmin: true };
    routes({ pendingUsers: 2, unlinkedOwners: 5 });
    render(await UserMenu());
    expect(menu().querySelector('summary')).toHaveTextContent(/Kevin.*2.*2 pending/);
    expect(link('Access requests, 2 pending')).toHaveAttribute('href', '/admin/requests');
  });

  // The header renders on every page: a BE hiccup must not take it down.
  it('drops the badge, not the header, when the summary fails', async () => {
    user.current = { ...user.current, isAdmin: true };
    routes(new ApiError(500, 'BE down'));
    render(await UserMenu());
    expect(link('Access requests')).toHaveAttribute('href', '/admin/requests');
  });

  // apiGet → requireActiveUser throws NEXT_REDIRECT when the session goes mid-render.
  it('lets a redirect through instead of swallowing it', async () => {
    user.current = { ...user.current, isAdmin: true };
    const redirect = Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/sign-in;307;' });
    routes(redirect);
    await expect(UserMenu()).rejects.toBe(redirect);
  });
});
