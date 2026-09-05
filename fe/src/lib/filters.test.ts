import { describe, it, expect } from 'vitest';
import { distinctValues, distinctArtists, locationPath, showsPhysicalDetail } from './filters';
import type { Album } from './types';

const album = (over: Partial<Album>): Album => ({
  id: 'a', collectionId: 'c', title: 't', format: null, year: null, genre: null,
  notes: null, coverImageUrl: null, artists: [], ...over,
});

describe('distinctValues', () => {
  it('de-duplicates and sorts, dropping empties', () => {
    const albums = [
      album({ format: 'LP' }), album({ format: '45' }), album({ format: 'LP' }), album({ format: null }),
    ];
    expect(distinctValues(albums, 'format')).toEqual(['45', 'LP']);
  });

  it('returns [] when nothing has a value', () => {
    expect(distinctValues([album({}), album({})], 'genre')).toEqual([]);
  });
});

describe('distinctArtists', () => {
  it('collects every credited artist once, sorted by name', () => {
    const miles = { id: '1', name: 'Miles Davis', sortName: null, notes: null };
    const coltrane = { id: '2', name: 'John Coltrane', sortName: null, notes: null };
    const albums = [album({ artists: [miles, coltrane] }), album({ artists: [miles] })];
    expect(distinctArtists(albums).map((a) => a.name)).toEqual(['John Coltrane', 'Miles Davis']);
  });

  it('tolerates albums with no artists', () => {
    expect(distinctArtists([album({})])).toEqual([]);
  });
});

describe('locationPath', () => {
  it('renders the parent chain the way the shelf actually reads', () => {
    expect(locationPath({ name: 'Shelf 3', parent: { name: 'Basement' } })).toBe('Basement → Shelf 3');
  });

  it('falls back to the bare name at the top of the tree', () => {
    expect(locationPath({ name: 'Basement', parent: null })).toBe('Basement');
  });
});

describe('showsPhysicalDetail', () => {
  it('is on for a physical collection and off for a digital one', () => {
    expect(showsPhysicalDetail('physical')).toBe(true);
    expect(showsPhysicalDetail('digital')).toBe(false);
  });
});
