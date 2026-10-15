import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const user = vi.hoisted(() => ({ current: { id: 'u-1', email: 'kevin@example.com', name: 'Kevin', avatar: null, status: 'active', isAdmin: false } }));
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn(async () => user.current) }));
vi.mock('@/app/pending/actions', () => ({ signOutAction: vi.fn() }));
vi.mock('@/app/theme/actions', () => ({ setThemeAction: vi.fn() }));
vi.mock('@/lib/themeChoice', () => ({ getThemeChoice: vi.fn(async () => 'warm') }));

import UserMenu from './UserMenu';

describe('UserMenu', () => {
  it('names the sign-out button "Sign out" and shows who is signed in', async () => {
    render(await UserMenu());
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.getByText('Kevin')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /requests/i })).not.toBeInTheDocument();
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

  it('links admins to access requests', async () => {
    user.current = { ...user.current, isAdmin: true };
    render(await UserMenu());
    expect(screen.getByRole('link', { name: /requests/i })).toHaveAttribute('href', '/admin/requests');
  });
});
