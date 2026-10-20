import type { Album, Artist } from '@/lib/types';
import ArtistPicker from './ArtistPicker';
import FormError from './FormError';

type Action = (formData: FormData) => Promise<void>;
type CreateArtist = (name: string) => Promise<{ artist: { id: string; name: string } } | { error: string }>;

const input = 'rounded-md border border-border bg-surface px-2 py-1 text-sm text-text';
const label = 'flex flex-col gap-1 text-sm text-text';
const primaryButton = 'rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-text';

/**
 * Add to the want list (#8). Album: pick one already in this collection, or
 * name a new one (it is created with no copies). Artist: "anything by", from
 * the list or a new name. Both halves are real fields; CSS in globals.css
 * shows the one the Album/Artist choice names, with no JS.
 */
export default function WantForm({ collectionId, albums, artists, albumId, artistId, action, createArtist, error, messages }: {
  collectionId: string;
  albums: Album[];
  artists: Pick<Artist, 'id' | 'name'>[];
  albumId?: string;
  artistId?: string;
  action: Action;
  createArtist: CreateArtist;
  error?: string;
  messages: Partial<Record<string, string>>;
}) {
  const sortedArtists = [...artists].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <form action={action} className="want-form flex flex-col gap-4">
      <FormError code={error} messages={messages} />
      <input type="hidden" name="collectionId" value={collectionId} />
      <fieldset className="flex gap-4 text-sm text-text">
        <legend className="mb-1">I want</legend>
        <label className="flex items-center gap-1.5">
          <input type="radio" name="kind" value="album" defaultChecked={!artistId} /> An album
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name="kind" value="artist" defaultChecked={!!artistId} /> Anything by an artist
        </label>
      </fieldset>

      <div className="want-album flex flex-col gap-3">
        <label className={label}>
          Album
          <select name="albumId" defaultValue={albumId ?? ''} className={input}>
            <option value="">A new album…</option>
            {albums.map((a) => (
              <option key={a.id} value={a.id}>
                {a.artists.length ? `${a.title} — ${a.artists.map((x) => x.name).join(', ')}` : a.title}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          New album title
          <input name="newTitle" className={input} placeholder="Only if it isn’t in the list" />
        </label>
        <ArtistPicker artists={artists} selected={[]} createArtist={createArtist} />
      </div>

      <div className="want-artist flex flex-col gap-3">
        <label className={label}>
          Artist
          <select name="artistId" defaultValue={artistId ?? ''} className={input}>
            <option value="">A new artist…</option>
            {sortedArtists.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className={label}>
          New artist name
          <input name="newArtist" className={input} placeholder="Only if they aren’t in the list" />
        </label>
      </div>

      <fieldset className="flex gap-4 text-sm text-text">
        <legend className="mb-1">Priority</legend>
        <label className="flex items-center gap-1.5">
          <input type="radio" name="priority" value="must-have" /> Must-have
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" name="priority" value="nice-to-have" defaultChecked /> Nice-to-have
        </label>
      </fieldset>
      <label className={label}>
        Notes
        <textarea name="notes" rows={2} className={input} placeholder="e.g. a mono pressing" />
      </label>
      <button type="submit" className={`${primaryButton} self-start`}>Add to want list</button>
    </form>
  );
}
