import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import RowFilter from './RowFilter';

const list = (n: number) => (
  <ul>{Array.from({ length: n }, (_, i) => <li key={i} data-filter={`shelf ${i}`}>Shelf {i}</li>)}</ul>
);

describe('RowFilter', () => {
  it('stays out of the way for a short list', () => {
    render(<RowFilter label="Filter locations" count={14}>{list(14)}</RowFilter>);
    expect(screen.queryByRole('searchbox')).toBeNull();
  });

  // #137: a filter box once the list is long.
  it('hides rows that do not match, ignoring case', () => {
    render(<RowFilter label="Filter locations" count={15}>{list(15)}</RowFilter>);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter locations' }), { target: { value: 'SHELF 1' } });
    const shown = screen.getAllByRole('listitem').filter((li) => !li.hidden);
    expect(shown.map((li) => li.textContent)).toEqual(['Shelf 1', 'Shelf 10', 'Shelf 11', 'Shelf 12', 'Shelf 13', 'Shelf 14']);
  });
});
