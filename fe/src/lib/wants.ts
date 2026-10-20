import { locationPath } from './filters';
import type { WantItem } from './types';

/** "Kind of Blue", or "Anything by John Coltrane" for an artist want. */
export const wantTitle = (want: WantItem): string =>
  want.album ? want.album.title : `Anything by ${want.artist?.name ?? 'an unknown artist'}`;

/** The album's artists for an album want; an artist want already names its artist in the title. */
export const wantArtists = (want: WantItem): string | null =>
  want.album ? want.album.artists.map((a) => a.name).join(', ') || null : null;

const sortKey = (want: WantItem): [string, string] => {
  const artist = want.album ? want.album.artists[0] : want.artist;
  return [(artist?.sortName ?? artist?.name ?? '').toLowerCase(), (want.album?.title ?? '').toLowerCase()];
};

const byArtistThenTitle = (a: WantItem, b: WantItem) => {
  const [ka, kb] = [sortKey(a), sortKey(b)];
  return ka[0].localeCompare(kb[0]) || ka[1].localeCompare(kb[1]);
};

/**
 * The want list's two groups (#8). The BE only accepts these two priorities,
 * but a row written before it checked must still show up somewhere, so
 * anything that isn't must-have reads as nice-to-have.
 */
export const groupWants = (wants: WantItem[]) => ({
  mustHave: wants.filter((w) => w.priority === 'must-have').sort(byArtistThenTitle),
  niceToHave: wants.filter((w) => w.priority !== 'must-have').sort(byArtistThenTitle),
});

/**
 * "Alex has one — Basement → Shelf 3": one line per owner per album, in the
 * BE's order (the wanted album first). Another pressing, or any album for an
 * artist want, is named, since it isn't the record on the list.
 */
export const matchLines = (want: WantItem): string[] =>
  (want.matches ?? []).flatMap((match) => {
    const byOwner = new Map<string, { name: string; count: number; places: string[] }>();
    for (const copy of match.copies) {
      const entry = byOwner.get(copy.owner.id) ?? { name: copy.owner.name, count: 0, places: [] };
      const place = locationPath(copy.location);
      entry.count += 1;
      if (!entry.places.includes(place)) entry.places.push(place);
      byOwner.set(copy.owner.id, entry);
    }
    const isWanted = match.album.id === want.albumId;
    return [...byOwner.values()].map(({ name, count, places }) => {
      const what = isWanted
        ? count === 1 ? 'one' : String(count)
        : count === 1 ? `“${match.album.title}”` : `${count} of “${match.album.title}”`;
      return `${name} has ${what} — ${places.join(', ')}`;
    });
  });
