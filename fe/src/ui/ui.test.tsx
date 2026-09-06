import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AlbumCard from './AlbumCard';
import CopyRow from './CopyRow';
import LocationPath from './LocationPath';
import type { Album, Copy, Location } from '@/lib/types';

const location = (over: Partial<Location> = {}): Location => ({
  id: 'l', name: 'Shelf 3', kind: 'physical', parentLocationId: 'p',
  parent: { id: 'p', name: 'Basement' }, ...over,
});

const copy = (over: Partial<Copy> = {}): Copy => ({
  id: 'c', albumId: 'a', locationId: 'l', location: location(), sourceId: null,
  source: null, dateAcquired: null, price: null, condition: null, notes: null, ...over,
});

const album = (over: Partial<Album> = {}): Album => ({
  id: 'a1', collectionId: 'c1', title: 'Kind of Blue', format: 'LP', year: 1959,
  genre: 'Jazz', notes: null, coverImageUrl: null,
  artists: [{ id: 'ar1', name: 'Miles Davis', sortName: null, notes: null }], ...over,
});

describe('AlbumCard', () => {
  it('shows title, artists and release meta, linking to the album', () => {
    render(<AlbumCard album={album()} />);
    expect(screen.getByText('Kind of Blue')).toBeInTheDocument();
    expect(screen.getByText('Miles Davis')).toBeInTheDocument();
    expect(screen.getByText('LP · 1959 · Jazz')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/album/a1');
  });

  it('omits the meta line entirely when nothing is known', () => {
    render(<AlbumCard album={album({ format: null, year: null, genre: null })} />);
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
  });

  it('joins multiple credited artists', () => {
    const artists = [
      { id: '1', name: 'Miles Davis', sortName: null, notes: null },
      { id: '2', name: 'John Coltrane', sortName: null, notes: null },
    ];
    render(<AlbumCard album={album({ artists })} />);
    expect(screen.getByText('Miles Davis, John Coltrane')).toBeInTheDocument();
  });
});

describe('LocationPath', () => {
  it('renders the full path', () => {
    render(<LocationPath location={location()} />);
    expect(screen.getByText('Basement → Shelf 3')).toBeInTheDocument();
  });
});

describe('CopyRow', () => {
  it('shows location, condition and acquisition for a physical collection', () => {
    render(
      <CopyRow
        collectionKind="physical"
        copy={copy({ condition: 'VG+', price: '24.99', source: { id: 's', type: 'store', name: 'Vinyl Vault' } })}
      />,
    );
    expect(screen.getByText('Basement → Shelf 3')).toBeInTheDocument();
    expect(screen.getByText('VG+')).toBeInTheDocument();
    expect(screen.getByText(/Vinyl Vault/)).toBeInTheDocument();
    expect(screen.getByText(/\$24\.99/)).toBeInTheDocument();
  });

  it('de-emphasizes condition and source for a digital collection (#14)', () => {
    render(
      <CopyRow
        collectionKind="digital"
        copy={copy({
          location: location({ name: 'iCloud Drive/Music', parent: null }),
          condition: 'VG+',
          source: { id: 's', type: 'store', name: 'Vinyl Vault' },
        })}
      />,
    );
    expect(screen.getByText('iCloud Drive/Music')).toBeInTheDocument();
    expect(screen.queryByText('VG+')).not.toBeInTheDocument();
    expect(screen.queryByText(/Vinyl Vault/)).not.toBeInTheDocument();
  });

  it('renders a bare row when only the location is known', () => {
    render(<CopyRow collectionKind="physical" copy={copy()} />);
    expect(screen.getByText('Basement → Shelf 3')).toBeInTheDocument();
  });
});
