import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import CollectionSettings from './CollectionSettings';

const collection = { id: 'c1', name: 'Vinyl', kind: 'physical', ownerId: 'u-1', notes: 'Basement shelves', albumCount: 3 };
const shares = [{ id: 'u-2', name: 'Alex', email: 'alex@example.com' }];
const candidates = [{ id: 'u-3', name: null, email: 'jamie@example.com' }, { id: 'u-4', name: 'Ruth', email: 'ruth@example.com' }];
const actions = { rename: vi.fn(), share: vi.fn(), unshare: vi.fn() };
const renderIt = (props: Partial<Parameters<typeof CollectionSettings>[0]> = {}) =>
  render(<CollectionSettings collection={collection} shares={shares} candidates={candidates} actions={actions} {...props} />);

// #125: rename and share, owner or admin only (the page enforces who).
describe('CollectionSettings', () => {
  it('renames with the current name and notes filled in', () => {
    renderIt();
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Vinyl');
    expect(screen.getByRole('textbox', { name: 'Notes' })).toHaveValue('Basement shelves');
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('lists who it is shared with, by name and email, with remove a second tap away', () => {
    renderIt();
    const row = screen.getByText('Alex').closest('li')!;
    expect(row).toHaveTextContent('alex@example.com');
    const remove = within(row).getByRole('button', { name: 'Stop sharing with Alex', hidden: true });
    expect(remove.closest('details')!.open).toBe(false);
  });

  it('offers approved people it isn’t shared with, by name or email', () => {
    renderIt();
    const pick = screen.getByRole('combobox', { name: 'Share with' });
    expect(pick).toHaveAttribute('name', 'userId');
    expect(within(pick).getAllByRole('option').map((o) => o.textContent)).toEqual(['Pick someone', 'jamie@example.com', 'Ruth (ruth@example.com)']);
  });

  it('says so when it isn’t shared and there is no one left to add', () => {
    renderIt({ shares: [], candidates: [] });
    expect(screen.getByText('Vinyl isn’t shared with anyone yet.')).toBeInTheDocument();
    expect(screen.getByText(/Everyone approved already has it/)).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Share with' })).toBeNull();
  });

  it('confirms what just happened, and shows a fixed message for an error, never the code', () => {
    const { rerender } = renderIt({ saved: 'share' });
    expect(screen.getByRole('status')).toHaveTextContent('Shared.');
    rerender(<CollectionSettings collection={collection} shares={shares} candidates={candidates} actions={actions} error="share-in-use" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/already shared/i);
    rerender(<CollectionSettings collection={collection} shares={shares} candidates={candidates} actions={actions} error="<b>x</b>" />);
    expect(screen.getByRole('alert')).not.toHaveTextContent('<b>x</b>');
  });
});
