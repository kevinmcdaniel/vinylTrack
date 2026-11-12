'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ArtistPicker from './ArtistPicker';

type AlbumRow = { id: string; title: string; year: number | null; artists: string[] };
type AlbumMatch = AlbumRow & { copyCount: number };
type CreateArtist = (name: string) => Promise<{ artist: { id: string; name: string } } | { error: string }>;

const input = 'rounded-md border border-border bg-surface px-2 py-1 text-sm text-text';
const label = 'flex flex-col gap-1 text-sm text-text';
const quietButton = 'rounded-md border border-border px-3 py-1 text-sm text-text';
const FORMATS = ['LP', '45', '78', 'CD', 'cassette', 'mp3', 'flac'];
const DEBOUNCE_MS = 300;

const describe = (a: AlbumRow) => [a.title, a.artists.join(', '), a.year].filter(Boolean).join(' · ');
const copies = (n: number) => (n === 0 ? 'no copies yet' : n === 1 ? '1 copy' : `${n} copies`);

/**
 * Which album a new copy is of (#123): one already in the collection, or a
 * new one created with it. Both halves are real fields and CSS in globals.css
 * shows the one the Existing/New choice names, so it works without JS; the
 * search is then a GET (its fields belong to the page's `album-search` form,
 * never the POST). JS adds search as you type and a warning when a new album
 * looks like one already there, which offers to switch to it. Warn, never block.
 */
export default function AlbumChoice({ collectionName, mode = 'existing', query = '', results = [], artists, createArtist, searchAlbums, findMatches }: {
  collectionName: string;
  mode?: 'existing' | 'new';
  query?: string;
  results?: AlbumRow[];
  artists: { id: string; name: string }[];
  createArtist: CreateArtist;
  searchAlbums: (q: string) => Promise<AlbumRow[]>;
  findMatches: (title: string, artistIds: string[]) => Promise<AlbumMatch[]>;
}) {
  const [q, setQ] = useState(query);
  const [searched, setSearched] = useState(query);
  const [rows, setRows] = useState(results);
  const [picked, setPicked] = useState<string | undefined>();
  const [matches, setMatches] = useState<AlbumMatch[]>([]);
  const [draft, setDraft] = useState<{ title: string; artistIds: string[] }>({ title: '', artistIds: [] });
  const existingRadio = useRef<HTMLInputElement>(null);
  const newPane = useRef<HTMLDivElement>(null);

  const latest = useRef(query);
  const runSearch = useCallback(async (value: string) => {
    latest.current = value;
    const found = await searchAlbums(value);
    // A slower answer to an older query must not replace a newer one.
    if (latest.current !== value) return;
    setRows(found);
    setSearched(value);
  }, [searchAlbums]);

  // Search as you type. The server rendered the first answer, so skip until q changes.
  useEffect(() => {
    if (q === searched) return;
    const timer = setTimeout(() => { void runSearch(q); }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q, searched, runSearch]);

  // Duplicate warning for a new album, as its title and artists change.
  useEffect(() => {
    let live = true;
    const timer = setTimeout(async () => {
      const found = draft.title.trim() ? await findMatches(draft.title, draft.artistIds) : [];
      if (live) setMatches(found);
    }, DEBOUNCE_MS);
    return () => { live = false; clearTimeout(timer); };
  }, [draft, findMatches]);

  // Title and ArtistPicker's checkboxes both bubble change events up to the pane.
  const readDraft = () => {
    const pane = newPane.current;
    if (!pane) return;
    const title = pane.querySelector<HTMLInputElement>('input[name="albumTitle"]')?.value ?? '';
    const artistIds = [...pane.querySelectorAll<HTMLInputElement>('input[name="artistIds"]:checked')].map((c) => c.value);
    setDraft({ title, artistIds });
  };

  const switchTo = (album: AlbumMatch) => {
    setRows((current) => (current.some((r) => r.id === album.id) ? current : [album, ...current]));
    setPicked(album.id);
    if (existingRadio.current) existingRadio.current.checked = true;
  };

  // With JS, Search and Enter search in place instead of reloading the page.
  const searchNow = (e: React.SyntheticEvent) => {
    e.preventDefault();
    void runSearch(q);
  };

  return (
    <div className="album-choice flex flex-col gap-3">
      <fieldset className="flex gap-4 text-sm text-text">
        <legend className="mb-1">Album</legend>
        <label className="flex items-center gap-1.5">
          <input ref={existingRadio} type="radio" name="albumMode" value="existing" defaultChecked={mode === 'existing'} /> Existing album
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name="albumMode" value="new" defaultChecked={mode === 'new'} /> New album
        </label>
      </fieldset>

      <div className="album-existing flex flex-col gap-3">
        <div className="flex items-end gap-2">
          <label className={`${label} flex-1`}>
            Find an album
            <input
              type="search"
              name="q"
              form="album-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') searchNow(e); }}
              placeholder="Title"
              className={input}
            />
          </label>
          <button type="submit" form="album-search" onClick={searchNow} className={quietButton}>Search</button>
        </div>
        {rows.length > 0 ? (
          <fieldset className="flex flex-col gap-1.5 text-sm text-text">
            <legend className="sr-only">Pick the album</legend>
            {rows.map((a) => (
              <label key={a.id} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="albumId"
                  value={a.id}
                  checked={picked === a.id}
                  onChange={() => setPicked(a.id)}
                />
                {describe(a)}
              </label>
            ))}
          </fieldset>
        ) : searched.trim() ? (
          <p className="text-sm text-text-muted">No album in {collectionName} matches. Pick New album to add it.</p>
        ) : null}
      </div>

      <div ref={newPane} onChange={readDraft} className="album-new flex flex-col gap-3">
        <label className={label}>
          Title
          <input name="albumTitle" className={input} />
        </label>
        {matches.length > 0 && (
          <div role="status" className="rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn-text">
            {matches.map((m) => (
              <p key={m.id} className="flex flex-wrap items-center gap-2">
                <span>Already in {collectionName}: {describe(m)} ({copies(m.copyCount)})</span>
                <button type="button" onClick={() => switchTo(m)} className="underline">Use it instead</button>
              </p>
            ))}
            <p className="mt-1">You can still add a new one: a second pressing is fine.</p>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>
            Format
            <input name="format" list="album-choice-formats" className={input} />
            <datalist id="album-choice-formats">{FORMATS.map((f) => <option key={f} value={f} />)}</datalist>
          </label>
          <label className={label}>
            Year
            <input name="year" type="number" inputMode="numeric" min={1877} max={2100} className={input} />
          </label>
        </div>
        <label className={label}>
          Genre
          <input name="genre" className={input} />
        </label>
        <ArtistPicker artists={artists} selected={[]} createArtist={createArtist} />
        <label className={label}>
          Album notes
          <textarea name="albumNotes" rows={2} className={input} />
        </label>
      </div>
    </div>
  );
}
