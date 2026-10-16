import type { Album, Artist } from '@/lib/types';
import ArtistPicker from './ArtistPicker';
import FormError from './FormError';

type Action = (formData: FormData) => Promise<void>;
type CreateArtist = (name: string) => Promise<{ artist: { id: string; name: string } } | { error: string }>;

const input = 'rounded-md border border-border bg-surface px-2 py-1 text-sm text-text';
const label = 'flex flex-col gap-1 text-sm text-text';
const primaryButton = 'rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-text';
const FORMATS = ['LP', '45', '78', 'CD', 'cassette', 'mp3', 'flac'];

/**
 * New or edit album (#102): one form for both. Blank optional fields clear on
 * edit (the action sends null). Format is free text with suggestions, since
 * the schema leaves it open (LP | 45 | 78 | CD | mp3 | …).
 */
export default function AlbumForm({ album, collectionId, artists, action, createArtist, submitLabel, error, messages }: {
  album?: Album;
  collectionId: string;
  artists: Pick<Artist, 'id' | 'name'>[];
  action: Action;
  createArtist: CreateArtist;
  submitLabel: string;
  error?: string;
  messages: Partial<Record<string, string>>;
}) {
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError code={error} messages={messages} />
      <input type="hidden" name="collectionId" value={collectionId} />
      {album && <input type="hidden" name="id" value={album.id} />}
      <label className={label}>
        Title
        <input name="title" required defaultValue={album?.title} className={input} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>
          Format
          <input name="format" list="album-formats" defaultValue={album?.format ?? ''} className={input} />
          <datalist id="album-formats">{FORMATS.map((f) => <option key={f} value={f} />)}</datalist>
        </label>
        <label className={label}>
          Year
          <input name="year" type="number" inputMode="numeric" min={1877} max={2100} defaultValue={album?.year ?? ''} className={input} />
        </label>
      </div>
      <label className={label}>
        Genre
        <input name="genre" defaultValue={album?.genre ?? ''} className={input} />
      </label>
      <ArtistPicker artists={artists} selected={album?.artists.map((a) => a.id) ?? []} createArtist={createArtist} />
      <label className={label}>
        Notes
        <textarea name="notes" rows={2} defaultValue={album?.notes ?? ''} className={input} />
      </label>
      <button type="submit" className={`${primaryButton} self-start`}>{submitLabel}</button>
    </form>
  );
}
