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
 * It says *where*, never *whose* (#53): a location belongs to a collection and
 * carries no owner, so two collections sharing one shelf are two rows that
 * happen to share a name.
 */
export type Location = {
  id: string;
  name: string;
  kind: string;
  collectionId: string;
  parentLocationId: string | null;
  parent: { id: string; name: string } | null;
};

/**
 * Whoever a copy belongs to. Not a user: a grandparent or a kid too young to
 * sign in owns records without an account (#53), so there is no email here to
 * render by accident.
 */
export type Owner = { id: string; name: string };

export type Source = { id: string; type: string; name: string };

export type Copy = {
  id: string;
  albumId: string;
  locationId: string;
  location: Location;
  /**
   * The copy's own owner, so lending a record does not appear to change hands
   * (#53). Nullable until the follow-up migration makes the column NOT NULL —
   * an unclaimed copy still has to render.
   */
  ownerId: string | null;
  owner: Owner | null;
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
