import { describe, it, expect } from 'vitest';
import type { WantItem, WantMatch } from './types';
import { groupWants, matchLines, wantArtists, wantTitle } from './wants';

const artist = (id: string, name: string, sortName: string | null = null) => ({ id, name, sortName, notes: null });
const miles = artist('miles', 'Miles Davis', 'Davis, Miles');
const trane = artist('trane', 'John Coltrane', 'Coltrane, John');
const album = (id: string, title: string, artists = [miles]) => ({
  id, collectionId: 'c1', title, format: null, year: null, genre: null, notes: null, coverImageUrl: null, artists,
});
const want = (over: Partial<WantItem>): WantItem => ({
  id: 'w', collectionId: 'c1', artistId: null, albumId: null, artist: null, album: null, priority: 'must-have', notes: null, ...over,
});
const copy = (id: string, owner: string, place: string, parent: string | null = null) => ({
  id,
  owner: { id: owner.toLowerCase(), name: owner },
  location: { id: `l-${place}`, name: place, parent: parent ? { id: `l-${parent}`, name: parent } : null },
});
const match = (a: ReturnType<typeof album>, copies: WantMatch['copies']): WantMatch => ({
  album: { id: a.id, title: a.title, artists: a.artists.map(({ id, name }) => ({ id, name })) },
  copies,
});

describe('wantTitle / wantArtists', () => {
  it('names an album want by its title and artists', () => {
    const w = want({ albumId: 'kob', album: album('kob', 'Kind of Blue', [miles, trane]) });
    expect(wantTitle(w)).toBe('Kind of Blue');
    expect(wantArtists(w)).toBe('Miles Davis, John Coltrane');
  });

  it('names an artist want as "Anything by …", with no artist line', () => {
    const w = want({ artistId: 'trane', artist: trane });
    expect(wantTitle(w)).toBe('Anything by John Coltrane');
    expect(wantArtists(w)).toBeNull();
  });
});

describe('groupWants', () => {
  it('splits must-have from nice-to-have, each sorted by artist then title', () => {
    const sketches = want({ id: 'a', albumId: 's', album: album('s', 'Sketches of Spain') });
    const kob = want({ id: 'b', albumId: 'k', album: album('k', 'Kind of Blue') });
    const anyTrane = want({ id: 'c', artistId: 'trane', artist: trane });
    const anyMiles = want({ id: 'd', artistId: 'miles', artist: miles, priority: 'nice-to-have' });
    const { mustHave, niceToHave } = groupWants([sketches, kob, anyTrane, anyMiles]);
    // Coltrane before Davis (sort names), then title within Davis.
    expect(mustHave.map((w) => w.id)).toEqual(['c', 'b', 'a']);
    expect(niceToHave.map((w) => w.id)).toEqual(['d']);
  });

  it('drops nothing: an unknown priority lands in nice-to-have', () => {
    const odd = want({ id: 'x', artistId: 'miles', artist: miles, priority: 'medium' });
    expect(groupWants([odd]).niceToHave.map((w) => w.id)).toEqual(['x']);
  });
});

describe('matchLines', () => {
  const kob = album('kob', 'Kind of Blue');
  const reissue = album('kob2', 'Kind Of Blue');

  it('says nothing when no one has it', () => {
    expect(matchLines(want({ albumId: 'kob', album: kob, matches: [] }))).toEqual([]);
  });

  it('the wanted album itself: "<owner> has one — <where>"', () => {
    const w = want({ albumId: 'kob', album: kob, matches: [match(kob, [copy('1', 'Alex', 'Shelf 3', 'Basement')])] });
    expect(matchLines(w)).toEqual(['Alex has one — Basement → Shelf 3']);
  });

  it('one line per owner, counting their copies and listing each place once', () => {
    const w = want({
      albumId: 'kob',
      album: kob,
      matches: [match(kob, [copy('1', 'Kevin', 'Shelf 3', 'Basement'), copy('2', 'Alex', "Alex's room"), copy('3', 'Kevin', 'Shelf 3', 'Basement')])],
    });
    expect(matchLines(w)).toEqual(['Kevin has 2 — Basement → Shelf 3', "Alex has one — Alex's room"]);
  });

  it('another pressing, or an artist want, names the album the owner has', () => {
    const w = want({
      albumId: 'kob',
      album: kob,
      matches: [match(kob, [copy('1', 'Alex', "Alex's room")]), match(reissue, [copy('2', 'Grandma Ruth', 'Basement')])],
    });
    expect(matchLines(w)).toEqual(["Alex has one — Alex's room", 'Grandma Ruth has “Kind Of Blue” — Basement']);
    const anyMiles = want({ artistId: 'miles', artist: miles, matches: [match(reissue, [copy('2', 'Grandma Ruth', 'Basement'), copy('3', 'Grandma Ruth', 'Attic')])] });
    expect(matchLines(anyMiles)).toEqual(['Grandma Ruth has 2 of “Kind Of Blue” — Basement, Attic']);
  });

  // #8 task 3: your own copy reads as yours, not by your owner name.
  it('says "You" for the caller\'s own owner row', () => {
    const w = want({
      albumId: 'kob',
      album: kob,
      matches: [match(kob, [copy('1', 'Kevin', 'Shelf 3', 'Basement')]), match(reissue, [copy('2', 'Kevin', 'Attic'), copy('3', 'Kevin', 'Den')])],
    });
    expect(matchLines(w, 'kevin')).toEqual(['You have one — Basement → Shelf 3', 'You have 2 of “Kind Of Blue” — Attic, Den']);
    expect(matchLines(w, 'someone-else')[0]).toBe('Kevin has one — Basement → Shelf 3');
  });
});
