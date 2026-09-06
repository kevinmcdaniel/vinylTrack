import { prisma } from '../database.js';

const withArtists = { artists: { include: { artist: true } } } as const;

// A copy's owner is the owner of the location it sits in — `copy` has no owner
// of its own (#2) — which is what lets the duplicate check say "Alex's room"
// rather than just naming a shelf (#13). Selected down to id+name on purpose:
// `user` carries an email, and a copy row has no business shipping a family
// member's email to the client.
const withCopies = {
  copies: {
    include: {
      location: { include: { parent: true, owner: { select: { id: true, name: true } } } },
      source: true,
    },
  },
} as const;

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

export const createAlbumService = async (data: {
  collectionId: string;
  title: string;
  format?: string;
  year?: number;
  genre?: string;
  notes?: string;
  coverImageUrl?: string;
  artistIds?: string[];
}) => {
  const { artistIds, ...albumData } = data;
  const album = await prisma.album.create({
    data: {
      ...albumData,
      ...(artistIds ? { artists: { create: artistIds.map((artistId) => ({ artistId })) } } : {}),
    },
    include: withArtists,
  });
  return flattenArtists(album);
};

export const updateAlbumService = async (
  id: string,
  data: {
    title?: string;
    format?: string;
    year?: number;
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

export const deleteAlbumService = async (id: string) => {
  return prisma.album.delete({ where: { id } });
};
