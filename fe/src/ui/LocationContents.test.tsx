import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import LocationContents from './LocationContents';
import type { Location, LocationCopy } from '@/lib/types';

const basement: Location = { id: 'b', name: 'Basement', kind: 'physical', collectionId: 'c1', parentLocationId: null, parent: null };
const shelf: Location = { id: 's', name: 'Shelf 3', kind: 'physical', collectionId: 'c1', parentLocationId: 'b', parent: { id: 'b', name: 'Basement' } };
const bin: Location = { id: 'x', name: 'Bin', kind: 'physical', collectionId: 'c1', parentLocationId: 's', parent: { id: 's', name: 'Shelf 3' } };
const copy = (id: string, location: Location, title: string, over: Partial<LocationCopy> = {}): LocationCopy => ({
  id, albumId: `a-${id}`, locationId: location.id, location, ownerId: 'o-1', owner: { id: 'o-1', name: 'Kevin' },
  sourceId: null, source: null, dateAcquired: null, price: null, condition: null, notes: null,
  album: { id: `a-${id}`, title, format: 'LP', artists: [{ id: 'ar', name: 'Miles Davis' }] }, ...over,
});

// #126: what's on a shelf, its boxes included.
describe('LocationContents', () => {
  const all = [basement, shelf, bin];

  it('counts the copies and links each to its album', () => {
    render(<LocationContents location={shelf} locations={all} copies={[copy('1', shelf, 'Kind of Blue'), copy('2', bin, 'Sketches of Spain')]} />);
    expect(screen.getByText('2 copies')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kind of Blue' })).toHaveAttribute('href', '/album/a-1');
  });

  it('shows artists, format, owner and, for a physical location, condition', () => {
    render(<LocationContents location={shelf} locations={all} copies={[copy('1', shelf, 'Kind of Blue', { condition: 'VG+' })]} />);
    const row = screen.getByRole('link', { name: 'Kind of Blue' }).closest('li')!;
    expect(row).toHaveTextContent('Miles Davis · LP');
    expect(row).toHaveTextContent('Kevin');
    expect(row).toHaveTextContent('VG+');
  });

  it('names the sub-location of a copy deeper down, relative to this one', () => {
    render(<LocationContents location={basement} locations={all} copies={[copy('1', basement, 'Blue'), copy('2', bin, 'Spain')]} />);
    const deep = screen.getByRole('link', { name: 'Spain' }).closest('li')!;
    expect(within(deep).getByText('Shelf 3 → Bin')).toBeInTheDocument();
    const here = screen.getByRole('link', { name: 'Blue' }).closest('li')!;
    expect(here).not.toHaveTextContent('Shelf 3');
  });

  it('says so when the location is empty, linking back to the locations', () => {
    render(<LocationContents location={shelf} locations={all} copies={[]} />);
    expect(screen.getByText(/Nothing here yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All locations' })).toHaveAttribute('href', '/collection/c1/locations');
  });

  it('uses the singular for one copy', () => {
    render(<LocationContents location={shelf} locations={all} copies={[copy('1', shelf, 'Kind of Blue')]} />);
    expect(screen.getByText('1 copy')).toBeInTheDocument();
  });
});
