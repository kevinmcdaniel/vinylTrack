import { prisma } from '../database.js';
import { ConflictError } from '../common/errorHandler.js';
import type { Prisma } from '../generated/client/client.js';

const withArtists = { artists: { include: { artist: true } } } as const;

// A copy carries its own owner (#53), so the duplicate check can say "Alex has
// one" and still be right after the record moves — the location only says
// where it is sitting. Owner is selected down to id+name on purpose: an
// `owner` row has no email, and neither should the payload.
const withCopies = {
  copies: {
    include: {
      location: { include: { parent: true } },
      owner: { select: { id: true, name: true } },
      source: true,
    },
    // Postgres decides row order otherwise, so the two copies of a duplicate
    // could swap between identical requests. Location name is the order the
    // answer is read in ("Alex's room" before "Shelf 3"); id only breaks a tie
    // between two copies in the same place.
    orderBy: [{ location: { name: 'asc' } }, { id: 'asc' }],
  },
  // `satisfies`, not `as const`: a const-asserted orderBy array is readonly,
  // which Prisma's mutable orderBy input rejects.
} satisfies Prisma.albumInclude;

const flattenArtists = <T extends { artists: { artist: unknown }[] }>(album: T) => {
  const { artists, ...rest } = album;
  return { ...rest, artists: artists.map((a) => a.artist) };
};

// accessibleCollectionIds: undefined = no restriction (admin caller);
// otherwise results are always confined to this set, intersected with an
// explicit collectionId filter if the caller also supplied one.
export const listAlbumsService = async (
  filters: {
    collectionId?: string;
    artistId?: string;
    format?: string;
    genre?: string;
    q?: string;
    // Opt-in (#13): answers "does anyone already own this, and where" in one
    // request instead of N+1 calls to /album/:id. Off by default so the browse
    // list (#38), which never renders copies, doesn't pay for the join.
    includeCopies?: boolean;
  },
  accessibleCollectionIds: string[] | undefined,
) => {
  const { collectionId, artistId, format, genre, q, includeCopies } = filters;
  const scopedCollectionIds = accessibleCollectionIds
    ? collectionId
      ? accessibleCollectionIds.filter((id) => id === collectionId)
      : accessibleCollectionIds
    : collectionId
      ? [collectionId]
      : undefined;
  const albums = await prisma.album.findMany({
    where: {
      ...(scopedCollectionIds ? { collectionId: { in: scopedCollectionIds } } : {}),
      ...(format ? { format } : {}),
      ...(genre ? { genre } : {}),
      ...(artistId ? { artists: { some: { artistId } } } : {}),
      // Title search for the browse UI (#7). ANDed with everything above, so
      // it can never widen the accessible-collection scope.
      ...(q ? { title: { contains: q, mode: 'insensitive' as const } } : {}),
    },
    // The copies come from the album relation, so they are confined to the
    // same accessible-collection scope as the album row itself — this flag
    // can add detail to a result, never a result.
    include: { ...withArtists, ...(includeCopies ? withCopies : {}) },
    orderBy: { title: 'asc' },
  });
  return albums.map(flattenArtists);
};

export const getAlbumService = async (id: string) => {
  const album = await prisma.album.findUnique({
    where: { id },
    include: {
      ...withArtists,
      // kind lets the UI de-emphasize condition/source for digital collections (#14).
      collection: { select: { id: true, name: true, kind: true } },
      ...withCopies,
    },
  });
  if (!album) return null;
  return flattenArtists(album);
};

export type NewAlbum = {
  collectionId: string;
  title: string;
  format?: string;
  year?: number | null;
  genre?: string;
  notes?: string;
  coverImageUrl?: string;
  artistIds?: string[];
};

// One album insert for every path that makes one (#123): plain create, found-it
// and add-copy, the last two inside their own transaction. Credits each artist once.
export const createAlbumWith = async (db: Prisma.TransactionClient, data: NewAlbum) => {
  const { artistIds, ...albumData } = data;
  const unique = [...new Set(artistIds ?? [])];
  const album = await db.album.create({
    data: {
      ...albumData,
      ...(unique.length ? { artists: { create: unique.map((artistId) => ({ artistId })) } } : {}),
    },
    include: withArtists,
  });
  return flattenArtists(album);
};

export const createAlbumService = (data: NewAlbum) => createAlbumWith(prisma, data);

// Two album rows are "the same record" (#13) when they sit in the same
// collection, their titles match ignoring case and punctuation, and they
// share an artist. Title alone would match every "Greatest Hits".
export const normalizeTitle = (title: string) => title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

// The add-copy duplicate warning (#123): that rule, for an album not created
// yet. With no artists named, title alone decides: it only ever warns. Albums
// with no copies count, since a want's album is the row a new copy should reuse.
// accessibleCollectionIds: undefined = admin; a collection outside it reads as no matches.
export const findAlbumMatchesService = async (
  query: { collectionId: string; title: string; artistIds: string[] },
  accessibleCollectionIds: string[] | undefined,
) => {
  const { collectionId, title, artistIds } = query;
  if (accessibleCollectionIds && !accessibleCollectionIds.includes(collectionId)) return [];
  const key = normalizeTitle(title);
  if (!key) return [];
  const candidates = await prisma.album.findMany({
    where: { collectionId, ...(artistIds.length ? { artists: { some: { artistId: { in: artistIds } } } } : {}) },
    select: {
      id: true,
      title: true,
      year: true,
      artists: { select: { artist: { select: { id: true, name: true } } } },
      _count: { select: { copies: true } },
    },
    orderBy: [{ title: 'asc' }, { id: 'asc' }],
  });
  return candidates
    .filter((a) => normalizeTitle(a.title) === key)
    .map(({ artists, _count, ...album }) => ({ ...album, artists: artists.map((a) => a.artist), copyCount: _count.copies }));
};

export const updateAlbumService = async (
  id: string,
  data: {
    title?: string;
    format?: string;
    year?: number | null;
    genre?: string;
    notes?: string;
    coverImageUrl?: string;
    artistIds?: string[];
  },
) => {
  const { artistIds, ...albumData } = data;
  const album = await prisma.$transaction(async (tx) => {
    if (artistIds) {
      await tx.album_artist.deleteMany({ where: { albumId: id } });
      await tx.album_artist.createMany({ data: artistIds.map((artistId) => ({ albumId: id, artistId })) });
    }
    return tx.album.update({ where: { id }, data: albumData, include: withArtists });
  });
  return flattenArtists(album);
};

// #36: album_artist rows are pure join rows and go with the album. Copies and
// want items are refused rather than cascaded — a copy row is acquisition
// history, and a want for a deleted album is a want for nothing. The FK
// restricts both (want_item since #56); the counts are here for the message.
export const deleteAlbumService = async (id: string) => {
  return prisma.$transaction(async (tx) => {
    const [copies, wants] = await Promise.all([
      tx.copy.count({ where: { albumId: id } }),
      tx.want_item.count({ where: { albumId: id } }),
    ]);
    const blockers = [
      copies && `${copies} ${copies === 1 ? 'copy' : 'copies'}`,
      wants && `${wants} want ${wants === 1 ? 'item' : 'items'}`,
    ].filter(Boolean);
    if (blockers.length) throw new ConflictError(`Album is still referenced by ${blockers.join(' and ')}.`);
    await tx.album_artist.deleteMany({ where: { albumId: id } });
    return tx.album.delete({ where: { id } });
  });
};
