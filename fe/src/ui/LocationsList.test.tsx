import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LocationsList from './LocationsList';
import type { Location } from '@/lib/types';

const actions = { create: vi.fn(), update: vi.fn(), remove: vi.fn() };
const basement: Location = { id: 'b', name: 'Basement', kind: 'physical', collectionId: 'c1', parentLocationId: null, parent: null };
const shelf: Location = { id: 's', name: 'Shelf 3', kind: 'physical', collectionId: 'c1', parentLocationId: 'b', parent: { id: 'b', name: 'Basement' } };
const bin: Location = { id: 'x', name: 'Bin', kind: 'physical', collectionId: 'c1', parentLocationId: 's', parent: { id: 's', name: 'Shelf 3' } };

describe('LocationsList', () => {
  const view = () => render(<LocationsList collection={{ id: 'c1', kind: 'physical' }} locations={[bin, shelf, basement]} actions={actions} />);

  // PR #110 review: a one-tap Delete beside Edit misfires on a phone.
  it('keeps Delete inside the closed Edit disclosure', () => {
    view();
    const del = screen.getByRole('button', { name: 'Delete Basement → Shelf 3 → Bin', hidden: true });
    const details = del.closest('details');
    expect(details).not.toBeNull();
    expect(details!.open).toBe(false);
    expect(details!.querySelector('summary')).toHaveTextContent('Edit');
  });

  it('shows each location by its full path, rows and picker alike', () => {
    view();
    expect(screen.getByText('Basement → Shelf 3 → Bin', { selector: 'span' })).toBeInTheDocument();
    const newParent = screen.getAllByRole('combobox', { name: 'Inside', hidden: true })[0]!;
    expect([...newParent.querySelectorAll('option')].map((o) => o.textContent)).toContain('Basement → Shelf 3 → Bin');
  });
});
