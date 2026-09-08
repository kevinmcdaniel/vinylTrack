import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AlbumCard from './AlbumCard';
import CopyRow from './CopyRow';
import LocationPath from './LocationPath';
import type { Album, Copy, Location } from '@/lib/types';

const location = (over: Partial<Location> = {}): Location => ({
  id: 'l', name: 'Shelf 3', kind: 'physical', collectionId: 'c1', parentLocationId: 'p',
  parent: { id: 'p', name: 'Basement' }, ...over,
});

const copy = (over: Partial<Copy> = {}): Copy => ({
  id: 'c', albumId: 'a', locationId: 'l', location: location(), ownerId: null, owner: null,
  sourceId: null, source: null, dateAcquired: null, price: null, condition: null, notes: null, ...over,
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

  // The whole point of listing copies rather than collapsing them to
  // "owned: yes" is knowing whose it is before you buy a second one (#13).
  it('names the family member whose copy it is', () => {
    render(
      <CopyRow collectionKind="physical" copy={copy({ owner: { id: 'o1', name: 'Alex' } })} />,
    );
    expect(screen.getByText('Alex')).toBeInTheDocument();
  });

  // #53: the owner is the copy's, so it does not change when the record does.
  // "Alex" stays "Alex" while the record sits in someone else's basement.
  it('keeps naming the owner when the copy sits somewhere else', () => {
    render(
      <CopyRow
        collectionKind="physical"
        copy={copy({
          owner: { id: 'o1', name: 'Alex' },
          location: location({ name: "Kevin's basement", parent: null }),
        })}
      />,
    );
    expect(screen.getByText('Alex')).toBeInTheDocument();
    expect(screen.getByText("Kevin's basement")).toBeInTheDocument();
  });

  it('shows the owner for a digital copy too, where condition and source are hidden', () => {
    render(
      <CopyRow
        collectionKind="digital"
        copy={copy({
          owner: { id: 'o1', name: 'Grandma Ruth' },
          location: location({ name: 'iCloud Drive/Music', parent: null }),
          condition: 'VG+',
        })}
      />,
    );
    expect(screen.getByText('Grandma Ruth')).toBeInTheDocument();
    expect(screen.queryByText('VG+')).not.toBeInTheDocument();
  });

  // Nullable until the follow-up migration (#53) — a copy nobody has claimed
  // still has to render.
  it('says nothing about ownership for a copy with no owner recorded', () => {
    render(<CopyRow collectionKind="physical" copy={copy({ owner: null })} />);
    expect(screen.getByText('Basement → Shelf 3')).toBeInTheDocument();
    expect(screen.queryByText(/·/)).not.toBeInTheDocument();
  });
});
