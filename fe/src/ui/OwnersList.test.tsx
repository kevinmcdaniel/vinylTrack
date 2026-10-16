import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import OwnersList from './OwnersList';

const actions = { create: vi.fn(), rename: vi.fn(), remove: vi.fn() };
const owners = [{ id: 'o-2', name: 'Grandma Ruth', userId: null }];

describe('OwnersList', () => {
  // #109/#110 review: a one-tap Delete beside Rename misfires on a phone.
  // It sits inside the closed Edit disclosure, a deliberate second tap away.
  it('keeps Delete inside the closed Edit disclosure', () => {
    render(<OwnersList owners={owners} canDelete actions={actions} />);
    const del = screen.getByRole('button', { name: 'Delete Grandma Ruth', hidden: true });
    const details = del.closest('details');
    expect(details).not.toBeNull();
    expect(details!.open).toBe(false);
    expect(details!.querySelector('summary')).toHaveTextContent('Edit');
  });

  it('offers no Delete to a member', () => {
    render(<OwnersList owners={owners} canDelete={false} actions={actions} />);
    expect(screen.queryByRole('button', { name: /Delete/, hidden: true })).toBeNull();
  });
});
