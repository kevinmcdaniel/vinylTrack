import { prisma } from '../database.js';
import type { Prisma } from '../generated/client/client.js';
import { ValidationError } from '../common/errorHandler.js';
import { assertLocationInCollection } from './copy.js';
import { ownerForUserService } from './owner.js';

const withRelations = {
  artist: true,
  album: { include: { artists: { include: { artist: true } } } },
} satisfies Prisma.want_itemInclude;

// An album-level want reads "Blue — Joni Mitchell", not just "Blue" (#8), so
// the album comes with its artists, flattened the way the album list does it.
const flattenWant = (want: Prisma.want_itemGetPayload<{ include: typeof withRelations }>) => {
  if (!want.album) return { ...want, album: null };
  const { artists, ...album } = want.album;
  return { ...want, album: { ...album, artists: artists.map((a) => a.artist) } };
};

// Two album rows are "the same record" (#13) when they sit in the same
// collection, their titles match ignoring case and punctuation, and they
// share an artist. Title alone would match every "Greatest Hits".
const normalizeTitle = (title: string) => title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

type MatchAlbum = {
  id: string;
  collectionId: string;
  title: string;
  artists: { artist: { id: string; name: string } }[];
  copies: {
    id: string;
    owner: { id: string; name: string };
    location: { id: string; name: string; parent: { id: string; name: string } | null };
  }[];
};

const findMatches = (
  want: { collectionId: string; artistId: string | null; albumId: string | null; album: { title: string; artists: { id: string }[] } | null },
  candidates: MatchAlbum[],
) => {
  const inCollection = candidates.filter((a) => a.collectionId === want.collectionId);
  let hits: MatchAlbum[];
  if (want.album) {
    const title = normalizeTitle(want.album.title);
    const artistIds = new Set(want.album.artists.map((a) => a.id));
    // An all-punctuation title normalizes to "": only its own row can match.
    hits = inCollection.filter(
      (a) =>
        a.id === want.albumId ||
        (title !== '' &&
          normalizeTitle(a.title) === title &&
          a.artists.some(({ artist }) => artistIds.has(artist.id))),
    );
    // The wanted row itself first, then other editions.
    hits.sort((a, b) => Number(b.id === want.albumId) - Number(a.id === want.albumId));
  } else {
    hits = inCollection.filter((a) => a.artists.some(({ artist }) => artist.id === want.artistId));
  }
  return hits.map(({ id, title, artists, copies }) => ({
    album: { id, title, artists: artists.map((a) => a.artist) },
    copies,
  }));
};

type FlatWant = ReturnType<typeof flattenWant>;

const withMatches = async (wants: FlatWant[]) => {
  if (wants.length === 0) return [];

  // Every match is the wanted album itself or shares an artist with the want,
  // so only those albums are candidates — bounded by the want list, not by
  // the size of the collection.
  const wantedAlbumIds = wants.flatMap((w) => (w.albumId ? [w.albumId] : []));
  const wantedArtistIds = [
    ...new Set(wants.flatMap((w) => (w.album ? w.album.artists.map((a) => a.id) : w.artistId ? [w.artistId] : []))),
  ];
  const candidates: MatchAlbum[] = await prisma.album.findMany({
    where: {
      collectionId: { in: [...new Set(wants.map((w) => w.collectionId))] },
      copies: { some: {} },
      OR: [{ id: { in: wantedAlbumIds } }, { artists: { some: { artistId: { in: wantedArtistIds } } } }],
    },
    select: {
      id: true,
      collectionId: true,
      title: true,
      artists: { select: { artist: { select: { id: true, name: true } } } },
      copies: {
        select: {
          id: true,
          owner: { select: { id: true, name: true } },
          location: { select: { id: true, name: true, parent: { select: { id: true, name: true } } } },
        },
        orderBy: [{ location: { name: 'asc' } }, { id: 'asc' }],
      },
    },
    orderBy: [{ title: 'asc' }, { id: 'asc' }],
  });
  return wants.map((want) => ({ ...want, matches: findMatches(want, candidates) }));
};

// accessibleCollectionIds: undefined = no restriction (admin caller);
// otherwise scoped to this set, intersected with an explicit collectionId
// filter if the caller also supplied one.
//
// includeMatches (#8, #13) answers "does anyone already have this, and where"
// for every row in one extra query: candidates are albums with at least one
// copy, in the wants' own collections only, so it can never widen the scope.
export const listWantItemsService = async (
  filters: { collectionId?: string; includeMatches?: boolean },
  accessibleCollectionIds: string[] | undefined,
) => {
  const { collectionId, includeMatches } = filters;
  const scopedCollectionIds = accessibleCollectionIds
    ? collectionId
      ? accessibleCollectionIds.filter((id) => id === collectionId)
      : accessibleCollectionIds
    : collectionId
      ? [collectionId]
      : undefined;
  const wants = (
    await prisma.want_item.findMany({
      where: { ...(scopedCollectionIds ? { collectionId: { in: scopedCollectionIds } } : {}) },
      include: withRelations,
      // must-have sorts before nice-to-have; id makes the order stable.
      orderBy: [{ priority: 'asc' }, { id: 'asc' }],
    })
  ).map(flattenWant);
  return includeMatches ? withMatches(wants) : wants;
};

/** One want with its matches (#8): what the found-it page warns with. */
export const getWantWithMatchesService = async (id: string) => {
  const want = await getWantItemService(id);
  return want && (await withMatches([want]))[0]!;
};

export const getWantItemService = async (id: string) => {
  const want = await prisma.want_item.findUnique({ where: { id }, include: withRelations });
  return want && flattenWant(want);
};

export const createWantItemService = async (data: {
  collectionId: string;
  artistId?: string;
  albumId?: string;
  priority: string;
  notes?: string;
}) => {
  return flattenWant(await prisma.want_item.create({ data, include: withRelations }));
};

export const updateWantItemService = async (
  id: string,
  data: { priority?: string; notes?: string },
) => {
  return flattenWant(await prisma.want_item.update({ where: { id }, data, include: withRelations }));
};

export const deleteWantItemService = async (id: string) => {
  return prisma.want_item.delete({ where: { id } });
};

// Converts a want item into a real copy (and, for an artist-level want, an
// album + album_artist credit if one wasn't picked/created already), then
// removes the want item — one atomic flow instead of delete-then-recreate.
//
// callerUserId is who is standing in the record store: with no explicit
// ownerId, the copy is attributed to that person's own owner row (#53), which
// is the overwhelmingly common case — you buy your own records.
export const markWantItemFoundService = async (
  id: string,
  callerUserId: string,
  data: {
    locationId: string;
    ownerId?: string;
    sourceId?: string;
    dateAcquired?: Date | null;
    price?: string | null;
    condition?: string;
    notes?: string;
    albumId?: string;
    album?: {
      title: string;
      format?: string;
      year?: number | null;
      genre?: string;
      notes?: string;
      coverImageUrl?: string;
    };
  },
) => {
  const want = await prisma.want_item.findUniqueOrThrow({ where: { id } });
  const { locationId, ownerId, sourceId, dateAcquired, price, condition, notes, albumId, album } = data;

  await assertLocationInCollection(locationId, want.collectionId);

  const resolvedOwnerId = ownerId ?? (await ownerForUserService(callerUserId))?.id;
  if (!resolvedOwnerId) {
    throw new ValidationError('ownerId is required — the caller has no owner of their own.');
  }

  return prisma.$transaction(async (tx) => {
    let resolvedAlbumId = want.albumId;

    if (!resolvedAlbumId) {
      if (albumId) {
        resolvedAlbumId = albumId;
      } else if (album) {
        const created = await tx.album.create({
          data: { collectionId: want.collectionId, ...album },
        });
        resolvedAlbumId = created.id;
      }
      if (want.artistId && resolvedAlbumId) {
        await tx.album_artist.upsert({
          where: { albumId_artistId: { albumId: resolvedAlbumId, artistId: want.artistId } },
          create: { albumId: resolvedAlbumId, artistId: want.artistId },
          update: {},
        });
      }
    }

    const copy = await tx.copy.create({
      data: {
        albumId: resolvedAlbumId as string,
        locationId,
        ownerId: resolvedOwnerId,
        sourceId,
        dateAcquired,
        price,
        condition,
        notes,
      },
      include: { location: true, owner: { select: { id: true, name: true } }, source: true },
    });
    const resultAlbum = await tx.album.findUniqueOrThrow({ where: { id: resolvedAlbumId as string } });
    await tx.want_item.delete({ where: { id } });

    return { copy, album: resultAlbum };
  });
};
