import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LocationsList from './LocationsList';
import type { Location } from '@/lib/types';

const actions = { create: vi.fn() };
const basement: Location = { id: 'b', name: 'Basement', kind: 'physical', collectionId: 'c1', parentLocationId: null, parent: null };
const shelf: Location = { id: 's', name: 'Shelf 3', kind: 'physical', collectionId: 'c1', parentLocationId: 'b', parent: { id: 'b', name: 'Basement' } };
const bin: Location = { id: 'x', name: 'Bin', kind: 'physical', collectionId: 'c1', parentLocationId: 's', parent: { id: 's', name: 'Shelf 3' } };
const drive: Location = { id: 'd', name: 'NAS', kind: 'digital', collectionId: 'c1', parentLocationId: null, parent: null };

describe('LocationsList', () => {
  const view = (locations = [bin, shelf, basement]) =>
    render(<LocationsList collection={{ id: 'c1', kind: 'physical' }} locations={locations} actions={actions} />);

  it('shows each location by its full path, rows and picker alike', () => {
    view();
    // #126: each name opens what's in that location.
    expect(screen.getByRole('link', { name: 'Basement → Shelf 3 → Bin' })).toHaveAttribute('href', '/location/x');
    const newParent = screen.getByRole('combobox', { name: 'Inside', hidden: true });
    expect([...newParent.querySelectorAll('option')].map((o) => o.textContent)).toContain('Basement → Shelf 3 → Bin');
  });

  // #137: one line per row, Edit on its own page, no forms in the rows.
  it('gives each location one row with an Edit link to its own page', () => {
    const { container } = view();
    const edit = screen.getByRole('link', { name: 'Edit Basement → Shelf 3' });
    expect(edit).toHaveAttribute('href', '/location/s/edit');
    expect(edit.closest('li')).toHaveTextContent(/^Basement → Shelf 3Edit$/);
    expect(container.querySelectorAll('li form, li details')).toHaveLength(0);
  });

  it('names a location’s kind only when it differs from the collection’s', () => {
    view([basement, drive]);
    expect(screen.getByRole('link', { name: 'Edit NAS' }).closest('li')).toHaveTextContent('digital');
    expect(screen.getByRole('link', { name: 'Edit Basement' }).closest('li')).not.toHaveTextContent('physical');
  });
});
