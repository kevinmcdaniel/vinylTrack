import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import UsersList from './UsersList';
import type { UserRow } from '@/lib/types';

const row = (over: Partial<UserRow>): UserRow => ({
  id: 'u-x', email: 'x@example.com', name: null, avatar: null, status: 'active', isAdmin: false, createdAt: '2026-10-01T00:00:00Z', ...over,
});
const users = [
  row({ id: 'u-1', email: 'me@family.example', name: 'Kevin', isAdmin: true }),
  row({ id: 'u-2', email: 'kevin@gmail.example', name: 'Kevin' }),
  row({ id: 'u-3', email: 'kevin@work.example', status: 'pending' }),
  row({ id: 'u-4', email: 'gone@example.com', status: 'denied' }),
];
const owners = [{ id: 'o-1', name: 'Kevin', userId: 'u-1' }, { id: 'o-2', name: 'Grandma Ruth', userId: null }];
const deny = vi.fn();
const item = (email: string) => screen.getByText(email).closest('li')!;

describe('UsersList', () => {
  // #124: two accounts can share a name, so the email is what tells them apart.
  it('lists every account with its email and status', () => {
    render(<UsersList users={users} owners={owners} meId="u-1" denyAction={deny} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(within(item('kevin@gmail.example')).getByText('Active')).toBeInTheDocument();
    expect(within(item('kevin@work.example')).getByText('Pending')).toBeInTheDocument();
    expect(within(item('gone@example.com')).getByText('Denied')).toBeInTheDocument();
  });

  it('tags admins, marks your own row and names a linked owner', () => {
    render(<UsersList users={users} owners={owners} meId="u-1" denyAction={deny} />);
    const me = item('me@family.example');
    expect(within(me).getByText('Admin')).toBeInTheDocument();
    expect(within(me).getByText('You')).toBeInTheDocument();
    expect(within(me).getByText(/Owns records as Kevin/)).toBeInTheDocument();
    expect(within(item('kevin@gmail.example')).queryByText('Admin')).toBeNull();
    expect(within(item('kevin@gmail.example')).queryByText(/Owns records as/)).toBeNull();
  });

  it('sends a pending account to the requests screen', () => {
    render(<UsersList users={users} owners={owners} meId="u-1" denyAction={deny} />);
    expect(within(item('kevin@work.example')).getByRole('link', { name: /Review request/ })).toHaveAttribute('href', '/admin/requests');
  });

  it('keeps Deny for another active account inside a closed disclosure', () => {
    render(<UsersList users={users} owners={owners} meId="u-1" denyAction={deny} />);
    const button = within(item('kevin@gmail.example')).getByRole('button', { name: 'Deny kevin@gmail.example', hidden: true });
    const details = button.closest('details');
    expect(details).not.toBeNull();
    expect(details!.open).toBe(false);
  });

  it('offers no Deny on your own row, a pending one, or a denied one', () => {
    render(<UsersList users={users} owners={owners} meId="u-1" denyAction={deny} />);
    expect(screen.getAllByRole('button', { name: /^Deny /, hidden: true })).toHaveLength(1);
  });

  it('shows a fixed message for a known error and never echoes an unknown one', () => {
    const { rerender } = render(<UsersList users={users} owners={owners} meId="u-1" error="not-found" denyAction={deny} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/no longer exists/);
    rerender(<UsersList users={users} owners={owners} meId="u-1" error="<b>x</b>" denyAction={deny} />);
    expect(screen.getByRole('alert')).not.toHaveTextContent('<b>x</b>');
  });
});
