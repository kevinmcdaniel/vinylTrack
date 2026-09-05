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

/** A location with its immediate parent resolved — enough for "Basement → Shelf 3". */
export type Location = {
  id: string;
  name: string;
  kind: string;
  parentLocationId: string | null;
  parent: { id: string; name: string } | null;
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

/** GET /api/artist/:id — albums are scoped to the caller's collections (#33). */
export type ArtistDetail = Artist & {
  albums: (Album & { collection: CollectionRef })[];
};
