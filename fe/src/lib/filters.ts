import type { Album } from './types';

/**
 * Distinct filter options derived from the albums already fetched, rather than
 * from a facets endpoint — a family collection is small enough that the list
 * response is a complete picture, and it keeps the API surface smaller (#7).
 */
export const distinctValues = (albums: Album[], key: 'format' | 'genre'): string[] =>
  [...new Set(albums.map((a) => a[key]).filter((v): v is string => Boolean(v)))].sort((a, b) =>
    a.localeCompare(b),
  );

/** Every artist credited on any album in the list, de-duplicated, by name. */
export const distinctArtists = (albums: Album[]): { id: string; name: string }[] => {
  const byId = new Map<string, { id: string; name: string }>();
  for (const album of albums) {
    for (const artist of album.artists ?? []) byId.set(artist.id, { id: artist.id, name: artist.name });
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
};

/** "Basement → Shelf 3"; just the name when a location has no parent. */
export const locationPath = (location: { name: string; parent?: { name: string } | null }): string =>
  location.parent ? `${location.parent.name} → ${location.name}` : location.name;

/** Condition and acquisition source are not meaningful for most digital copies (#14). */
export const showsPhysicalDetail = (collectionKind: string): boolean => collectionKind !== 'digital';
