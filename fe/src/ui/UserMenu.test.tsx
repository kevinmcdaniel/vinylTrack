import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const user = vi.hoisted(() => ({ current: { id: 'u-1', email: 'kevin@example.com', name: 'Kevin', avatar: null, status: 'active', isAdmin: false } }));
vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn(async () => user.current) }));
vi.mock('@/app/pending/actions', () => ({ signOutAction: vi.fn() }));

import UserMenu from './UserMenu';

describe('UserMenu', () => {
  it('names the sign-out button "Sign out" and shows who is signed in', async () => {
    render(await UserMenu());
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.getByText('Kevin')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /requests/i })).not.toBeInTheDocument();
  });

  it('links admins to access requests', async () => {
    user.current = { ...user.current, isAdmin: true };
    render(await UserMenu());
    expect(screen.getByRole('link', { name: /requests/i })).toHaveAttribute('href', '/admin/requests');
  });
});
