import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const user = vi.hoisted(() => ({ current: { id: 'u-1', email: 'kevin@example.com', name: 'Kevin', avatar: null, status: 'active', isAdmin: false } }));
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn(async () => user.current) }));
vi.mock('@/app/pending/actions', () => ({ signOutAction: vi.fn() }));
vi.mock('@/app/theme/actions', () => ({ setThemeAction: vi.fn() }));
vi.mock('@/lib/themeChoice', () => ({ getThemeChoice: vi.fn(async () => 'warm') }));
const apiGet = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ apiGet }));

import UserMenu from './UserMenu';

describe('UserMenu', () => {
  beforeEach(() => {
    user.current = { ...user.current, isAdmin: false };
    apiGet.mockReset().mockResolvedValue({ pendingUsers: 0, unlinkedOwners: 0 });
  });

  it('names the sign-out button "Sign out" and shows who is signed in', async () => {
    render(await UserMenu());
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.getByText('Kevin')).toBeInTheDocument();
  });

  // Help is for everyone (#90, PR #96 review): reachable without typing the URL.
  it.each([[false], [true]])('links to /help (admin: %s)', async (isAdmin) => {
    user.current = { ...user.current, isAdmin };
    render(await UserMenu());
    expect(screen.getByRole('link', { name: 'Help' })).toHaveAttribute('href', '/help');
  });

  it('lets anyone pick a theme, showing this device\'s choice', async () => {
    render(await UserMenu());
    expect(screen.getByRole('combobox', { name: 'Theme' })).toHaveValue('warm');
  });

  // Six items for an admin overflowed a 375px phone (PR #97 review). jsdom
  // can't measure, so this pins the fix: wrap to a second row, never mid-label.
  it('wraps onto a second row instead of overflowing a phone screen', async () => {
    render(await UserMenu());
    expect(screen.getByRole('navigation')).toHaveClass('flex-wrap', 'justify-end', 'whitespace-nowrap');
  });

  // Back office (#90): "Admin" replaces "Requests", and non-admins pay nothing.
  it('shows a non-admin no Admin link and asks the BE for no summary', async () => {
    render(await UserMenu());
    expect(screen.queryByRole('link', { name: /admin|requests/i })).not.toBeInTheDocument();
    expect(apiGet).not.toHaveBeenCalled();
  });

  it('links admins to /admin with no badge when nothing is pending', async () => {
    user.current = { ...user.current, isAdmin: true };
    render(await UserMenu());
    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin');
    expect(screen.queryByRole('link', { name: /requests/i })).not.toBeInTheDocument();
    expect(apiGet).toHaveBeenCalledWith('/admin/summary');
  });

  it('badges the Admin link with the pending request count', async () => {
    user.current = { ...user.current, isAdmin: true };
    apiGet.mockResolvedValue({ pendingUsers: 2, unlinkedOwners: 5 });
    render(await UserMenu());
    const link = screen.getByRole('link', { name: 'Admin, 2 pending' });
    expect(link).toHaveAttribute('href', '/admin');
    expect(link).toHaveTextContent(/^Admin2/);
  });

  // The header renders on every page: a BE hiccup must not take it down.
  it('drops the badge, not the header, when the summary fails', async () => {
    user.current = { ...user.current, isAdmin: true };
    apiGet.mockRejectedValue(new Error('BE down'));
    render(await UserMenu());
    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin');
  });
});
