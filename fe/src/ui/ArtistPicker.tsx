'use client';

import { useId, useState, useTransition } from 'react';

type ArtistRef = { id: string; name: string };
type CreateArtist = (name: string) => Promise<{ artist: ArtistRef } | { error: string }>;

const input = 'w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-text';

/**
 * Pick an album's artists (#102). Every artist is a real `artistIds` checkbox,
 * so the form still posts the right list before JS loads; typing narrows the
 * list (checked ones stay) and offers to add a name that isn't there yet.
 * The full list comes from the server: family scale, no BE search needed.
 */
export default function ArtistPicker({ artists: initial, selected: initialSelected, createArtist }: {
  artists: ArtistRef[];
  selected: string[];
  createArtist: CreateArtist;
}) {
  const [artists, setArtists] = useState(initial);
  const [selected, setSelected] = useState(() => new Set(initialSelected));
  const [query, setQuery] = useState('');
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const searchId = useId();

  const q = query.trim().toLowerCase();
  const shown = artists
    .filter((a) => selected.has(a.id) || !q || a.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));
  const exists = artists.some((a) => a.name.toLowerCase() === q);

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id); else next.delete(id);
      return next;
    });

  const add = () => {
    const name = query.trim();
    setFailed(false);
    startTransition(async () => {
      const result = await createArtist(name);
      if ('artist' in result) {
        setArtists((prev) => [...prev, result.artist]);
        toggle(result.artist.id, true);
        setQuery('');
      } else {
        setFailed(true);
      }
    });
  };

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm text-text">Artists</legend>
      <label htmlFor={searchId} className="sr-only">Find an artist</label>
      <input
        id={searchId}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        // Enter (a phone's "Go") must never submit the album form half-filled
        // (PR #112 review). Nor does it add: mid-filter text like "mil" would
        // become a junk artist. Adding is the explicit button only.
        onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
        placeholder="Find or add an artist"
        className={input}
      />
      {q && !exists && (
        <button type="button" onClick={add} disabled={pending} className="self-start text-sm text-primary underline">
          Add &ldquo;{query.trim()}&rdquo;
        </button>
      )}
      {failed && (
        <p role="status" className="text-sm text-danger-text">Couldn&rsquo;t add that artist. Please try again.</p>
      )}
      <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-md border border-border bg-surface p-2">
        {shown.length === 0 && <li className="text-sm text-text-muted">No artists match.</li>}
        {shown.map((a) => (
          <li key={a.id}>
            <label className="flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                name="artistIds"
                value={a.id}
                checked={selected.has(a.id)}
                onChange={(e) => toggle(a.id, e.target.checked)}
              />
              {a.name}
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}
