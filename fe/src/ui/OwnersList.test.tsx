import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import OwnersList from './OwnersList';

const actions = { create: vi.fn() };
const owners = [
  { id: 'o-1', name: 'Kevin', userId: 'u-1' },
  { id: 'o-2', name: 'Grandma Ruth', userId: null },
];

describe('OwnersList', () => {
  // #137: one line per row, Edit on its own page.
  it('gives each owner one row with an Edit link to its own page', () => {
    render(<OwnersList owners={owners} actions={actions} />);
    const edit = screen.getByRole('link', { name: 'Edit Grandma Ruth' });
    expect(edit).toHaveAttribute('href', '/owners/o-2/edit');
    expect(edit.closest('li')).toHaveTextContent(/^Grandma RuthEdit$/);
  });

  it('says only when an owner is linked to an account', () => {
    render(<OwnersList owners={owners} actions={actions} />);
    expect(screen.getByRole('link', { name: 'Edit Kevin' }).closest('li')).toHaveTextContent('Linked to an account');
    expect(screen.queryByText('No account')).toBeNull();
  });

  it('has no rename or delete forms in the list', () => {
    const { container } = render(<OwnersList owners={owners} actions={actions} />);
    expect(container.querySelectorAll('details')).toHaveLength(0);
    expect(container.querySelectorAll('form')).toHaveLength(1);
  });
});
