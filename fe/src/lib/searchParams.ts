import type { Album } from './types';

/** The album filters the browse list understands, as they arrive in the URL. */
export type AlbumFilters = {
  collectionId: string;
  q?: string;
  artistId?: string;
  format?: string;
  genre?: string;
};

/**
 * Next gives a repeated query param as an array (`?q=a&q=b`). The API takes a
 * single value for each of these, so collapse to the first and ignore the rest
 * rather than sending something the BE will not understand.
 */
export const one = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

export const albumFiltersFrom = (
  collectionId: string,
  search: Record<string, string | string[] | undefined>,
): AlbumFilters => ({
  collectionId,
  q: one(search.q),
  artistId: one(search.artistId),
  format: one(search.format),
  genre: one(search.genre),
});

/**
 * Whether anything beyond the collection itself is narrowing the list. Drives
 * two things: the empty-state wording, and whether a second unfiltered fetch
 * is needed to build the filter options (see `filterOptionSource`).
 */
export const hasActiveFilters = (filters: AlbumFilters): boolean =>
  Boolean(filters.q || filters.artistId || filters.format || filters.genre);

/**
 * Filter options must come from the collection as a whole — deriving them from
 * a filtered result would erase every choice the current filter excludes. That
 * needs a second, unfiltered fetch, but only when a filter is actually active;
 * otherwise the list already in hand *is* the whole collection.
 */
export const needsUnfilteredFetch = (filters: AlbumFilters): boolean => hasActiveFilters(filters);

export const filterOptionSource = async (
  filters: AlbumFilters,
  albums: Album[],
  fetchAll: () => Promise<Album[]>,
): Promise<Album[]> => (needsUnfilteredFetch(filters) ? fetchAll() : albums);
