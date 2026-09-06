// Mirrors the shapes the BE services return (be/src/service/*.ts). The API
// wraps every response in { message, data, status } — see apiGet in ./api.

export type Collection = {
  id: string;
  name: string;
  kind: 'physical' | 'digital' | string;
  ownerId: string;
  notes: string | null;
  albumCount: number;
};

export type CollectionRef = Pick<Collection, 'id' | 'name'> & { kind?: string };

export type Artist = {
  id: string;
  name: string;
  sortName: string | null;
  notes: string | null;
};

export type Album = {
  id: string;
  collectionId: string;
  title: string;
  format: string | null;
  year: number | null;
  genre: string | null;
  notes: string | null;
  coverImageUrl: string | null;
  artists: Artist[];
};

/**
 * A location with its immediate parent resolved — enough for "Basement → Shelf 3".
 *
 * `owner` is how a copy gets attributed to a family member: `copy` has no owner
 * of its own, so "Alex's room" comes from the location (#13). The BE selects it
 * down to id+name, so there is deliberately no email here.
 */
export type Location = {
  id: string;
  name: string;
  kind: string;
  parentLocationId: string | null;
  parent: { id: string; name: string } | null;
  owner: { id: string; name: string | null } | null;
};

export type Source = { id: string; type: string; name: string };

export type Copy = {
  id: string;
  albumId: string;
  locationId: string;
  location: Location;
  sourceId: string | null;
  source: Source | null;
  dateAcquired: string | null;
  price: string | null;
  condition: string | null;
  notes: string | null;
};

/** GET /api/album/:id — adds the owning collection and every owned copy. */
export type AlbumDetail = Album & {
  collection: CollectionRef & { kind: string };
  copies: Copy[];
};

/**
 * GET /api/album?includeCopies=true — the duplicate check (#13). Same rows as
 * the plain list, each carrying its copies, so "does anyone already own this,
 * and where" is one request rather than one per want-list row.
 */
export type AlbumWithCopies = Album & { copies: Copy[] };

/** GET /api/artist/:id — albums are scoped to the caller's collections (#33). */
export type ArtistDetail = Artist & {
  albums: (Album & { collection: CollectionRef })[];
};
