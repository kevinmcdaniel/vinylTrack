import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CollectionSwitcher from './CollectionSwitcher';
import FilterBar from './FilterBar';
import type { Collection } from '@/lib/types';

const push = vi.fn();
let currentParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/collection/c1',
  useSearchParams: () => currentParams,
}));

beforeEach(() => {
  push.mockClear();
  currentParams = new URLSearchParams();
});

const collection = (id: string, name: string, albumCount: number): Collection => ({
  id, name, kind: 'physical', ownerId: 'u1', notes: null, albumCount,
});

describe('CollectionSwitcher', () => {
  const collections = [collection('c1', 'Vinyl', 12), collection('c2', 'Square Dance Calls', 3)];

  it('lists every accessible collection with its size', () => {
    render(<CollectionSwitcher collections={collections} currentId="c1" />);
    expect(screen.getByRole('option', { name: 'Vinyl (12)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Square Dance Calls (3)' })).toBeInTheDocument();
  });

  it('shows the collection currently being browsed as selected', () => {
    render(<CollectionSwitcher collections={collections} currentId="c2" />);
    expect(screen.getByRole('combobox', { name: 'Collection' })).toHaveValue('c2');
  });

  it('navigates to the collection you pick', async () => {
    render(<CollectionSwitcher collections={collections} currentId="c1" />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Collection' }), 'c2');
    expect(push).toHaveBeenCalledWith('/collection/c2');
  });
});

describe('FilterBar', () => {
  const options = {
    artists: [{ id: 'ar1', name: 'Miles Davis' }],
    formats: ['45', 'LP'],
    genres: ['Jazz'],
  };

  it('puts a submitted search into the url as q', async () => {
    render(<FilterBar options={options} />);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search by title' }), 'blue{Enter}');
    expect(push).toHaveBeenCalledWith('/collection/c1?q=blue');
  });

  it('trims whitespace off the query', async () => {
    render(<FilterBar options={options} />);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search by title' }), '  blue  {Enter}');
    expect(push).toHaveBeenCalledWith('/collection/c1?q=blue');
  });

  it('puts a chosen artist into the url', async () => {
    render(<FilterBar options={options} />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Artist' }), 'ar1');
    expect(push).toHaveBeenCalledWith('/collection/c1?artistId=ar1');
  });

  it('keeps existing filters when adding another', async () => {
    currentParams = new URLSearchParams('q=blue');
    render(<FilterBar options={options} />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Format' }), 'LP');
    expect(push).toHaveBeenCalledWith('/collection/c1?q=blue&format=LP');
  });

  it('removes a filter when it is set back to "any"', async () => {
    currentParams = new URLSearchParams('q=blue&genre=Jazz');
    render(<FilterBar options={options} />);
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Genre' }), '');
    expect(push).toHaveBeenCalledWith('/collection/c1?q=blue');
  });

  it('shows the active query in the box, sourced from the url', () => {
    currentParams = new URLSearchParams('q=blue');
    render(<FilterBar options={options} />);
    expect(screen.getByRole('searchbox', { name: 'Search by title' })).toHaveValue('blue');
  });

  it('offers Clear filters only when something is filtered', async () => {
    const { unmount } = render(<FilterBar options={options} />);
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
    unmount();

    currentParams = new URLSearchParams('format=LP');
    render(<FilterBar options={options} />);
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(push).toHaveBeenCalledWith('/collection/c1');
  });
});
