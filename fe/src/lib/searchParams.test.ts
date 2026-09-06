import { describe, it, expect, vi } from 'vitest';
import {
  one,
  albumFiltersFrom,
  hasActiveFilters,
  needsUnfilteredFetch,
  filterOptionSource,
} from './searchParams';
import type { Album } from './types';

const album = (over: Partial<Album> = {}): Album => ({
  id: 'a', collectionId: 'c', title: 't', format: null, year: null, genre: null,
  notes: null, coverImageUrl: null, artists: [], ...over,
});

describe('one', () => {
  it('passes a single value through', () => {
    expect(one('blue')).toBe('blue');
  });

  it('collapses a repeated param to the first value', () => {
    expect(one(['blue', 'green'])).toBe('blue');
  });

  it('is undefined when the param is absent', () => {
    expect(one(undefined)).toBeUndefined();
  });

  it('is undefined for an empty array rather than throwing', () => {
    expect(one([])).toBeUndefined();
  });
});

describe('albumFiltersFrom', () => {
  it('always carries the collection id', () => {
    expect(albumFiltersFrom('c1', {})).toEqual({
      collectionId: 'c1', q: undefined, artistId: undefined, format: undefined, genre: undefined,
    });
  });

  it('reads every supported filter off the url', () => {
    const f = albumFiltersFrom('c1', { q: 'blue', artistId: 'ar1', format: 'LP', genre: 'Jazz' });
    expect(f).toEqual({ collectionId: 'c1', q: 'blue', artistId: 'ar1', format: 'LP', genre: 'Jazz' });
  });

  it('collapses repeated params', () => {
    expect(albumFiltersFrom('c1', { q: ['blue', 'green'] }).q).toBe('blue');
  });

  it('ignores params it does not understand', () => {
    expect(albumFiltersFrom('c1', { nonsense: 'x' })).not.toHaveProperty('nonsense');
  });
});

describe('hasActiveFilters', () => {
  it('is false when only the collection is set', () => {
    expect(hasActiveFilters({ collectionId: 'c1' })).toBe(false);
  });

  it.each(['q', 'artistId', 'format', 'genre'] as const)('is true when %s is set', (key) => {
    expect(hasActiveFilters({ collectionId: 'c1', [key]: 'x' })).toBe(true);
  });

  it('treats an empty string as no filter', () => {
    expect(hasActiveFilters({ collectionId: 'c1', q: '' })).toBe(false);
  });
});

describe('filterOptionSource', () => {
  it('reuses the list already fetched when nothing is filtered', async () => {
    const fetchAll = vi.fn(async () => [album({ id: 'other' })]);
    const albums = [album({ id: 'have' })];
    await expect(filterOptionSource({ collectionId: 'c1' }, albums, fetchAll)).resolves.toBe(albums);
    expect(fetchAll).not.toHaveBeenCalled();
  });

  it('fetches the whole collection when a filter is active, so options are not narrowed away', async () => {
    const all = [album({ id: 'all' })];
    const fetchAll = vi.fn(async () => all);
    const filtered = [album({ id: 'filtered' })];
    await expect(
      filterOptionSource({ collectionId: 'c1', genre: 'Jazz' }, filtered, fetchAll),
    ).resolves.toBe(all);
    expect(fetchAll).toHaveBeenCalledOnce();
  });

  it('needsUnfilteredFetch tracks hasActiveFilters', () => {
    expect(needsUnfilteredFetch({ collectionId: 'c1' })).toBe(false);
    expect(needsUnfilteredFetch({ collectionId: 'c1', format: 'LP' })).toBe(true);
  });
});
