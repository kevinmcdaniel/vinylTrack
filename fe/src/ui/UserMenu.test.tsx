import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';

const user = vi.hoisted(() => ({ current: { id: 'u-1', email: 'kevin@example.com', name: 'Kevin', avatar: null, status: 'active', isAdmin: false } }));
const apiGet = vi.hoisted(() => vi.fn());
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn(async () => user.current) }));
vi.mock('@/lib/api', () => ({ apiGet }));
vi.mock('@/app/pending/actions', () => ({ signOutAction: vi.fn() }));

import UserMenu from './UserMenu';

const asAdmin = (isAdmin: boolean) => { user.current = { ...user.current, isAdmin }; };

describe('UserMenu', () => {
  beforeEach(() => { asAdmin(false); apiGet.mockReset(); });

  it('names the sign-out button "Sign out" and shows who is signed in', async () => {
    render(await UserMenu());
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.getByText('Kevin')).toBeInTheDocument();
  });

  // Help is for everyone (#90, PR #96 review): reachable without typing the URL.
  it.each([[false], [true]])('links to /help (admin: %s)', async (isAdmin) => {
    asAdmin(isAdmin);
    apiGet.mockResolvedValue({ pendingUsers: 0, unlinkedOwners: 0 });
    render(await UserMenu());
    expect(screen.getByRole('link', { name: 'Help' })).toHaveAttribute('href', '/help');
  });

  // Requests moved under /admin (#90).
  it.each([[false], [true]])('has no Requests link (admin: %s)', async (isAdmin) => {
    asAdmin(isAdmin);
    apiGet.mockResolvedValue({ pendingUsers: 1, unlinkedOwners: 0 });
    render(await UserMenu());
    expect(screen.queryByRole('link', { name: /requests/i })).not.toBeInTheDocument();
  });

  it('shows a non-admin no Admin link, and asks the BE for nothing', async () => {
    render(await UserMenu());
    expect(screen.queryByRole('link', { name: /admin/i })).not.toBeInTheDocument();
    expect(apiGet).not.toHaveBeenCalled();
  });

  it('links admins to /admin with a badge counting pending requests', async () => {
    asAdmin(true);
    apiGet.mockResolvedValue({ pendingUsers: 2, unlinkedOwners: 5 });
    render(await UserMenu());
    const link = screen.getByRole('link', { name: /admin/i });
    expect(link).toHaveAttribute('href', '/admin');
    expect(within(link).getByText('2')).toBeInTheDocument();
    expect(link).toHaveAccessibleName('Admin, 2 pending requests');
    expect(apiGet).toHaveBeenCalledWith('/admin/summary');
  });

  it('shows no badge at zero', async () => {
    asAdmin(true);
    apiGet.mockResolvedValue({ pendingUsers: 0, unlinkedOwners: 3 });
    render(await UserMenu());
    expect(screen.getByRole('link', { name: 'Admin' })).toBeInTheDocument();
  });

  // The header is on every page: a summary failure costs the badge, not the page.
  it('keeps the Admin link, without a badge, when the summary fails', async () => {
    asAdmin(true);
    apiGet.mockRejectedValue(new Error('BE down'));
    render(await UserMenu());
    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin');
  });
});
