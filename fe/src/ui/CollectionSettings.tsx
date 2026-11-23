import type { Collection } from '@/lib/types';
import FormError from './FormError';

type Action = (formData: FormData) => Promise<void>;
type Person = { id: string; name: string | null; email: string };

const input = 'rounded-md border border-border bg-surface px-2 py-1 text-sm text-text';
const label = 'flex flex-col gap-1 text-sm text-text';
const primaryButton = 'rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-text';
const quietButton = 'text-sm text-primary underline';

// ?error= and ?saved= are user-controlled, so each only ever picks a line here.
const ERRORS = {
  'rename-invalid': 'Give the collection a name.',
  'rename-forbidden': 'Only the collection’s owner can rename it.',
  'rename-not-found': 'That collection no longer exists.',
  'share-invalid': 'Pick someone approved to share with.',
  'share-in-use': 'It’s already shared with them.',
  'share-forbidden': 'Only the collection’s owner can share it.',
  'share-not-found': 'That collection no longer exists.',
  'unshare-not-found': 'It wasn’t shared with them any more.',
  'unshare-forbidden': 'Only the collection’s owner can change who has it.',
};
const SAVED: Record<string, string> = { rename: 'Saved.', share: 'Shared.', unshare: 'No longer shared.' };

const describe = (p: Person) => (p.name ? `${p.name} (${p.email})` : p.email);

/**
 * A collection's settings (#125): rename, and who it's shared with. The page
 * lets only the owner or an admin in. Plain forms, so it works before JS
 * loads; removing someone is a second tap away, like every delete (#102).
 */
export default function CollectionSettings({ collection, shares, candidates, error, saved, actions }: {
  collection: Collection;
  shares: Person[];
  candidates: Person[];
  error?: string;
  saved?: string;
  actions: { rename: Action; share: Action; unshare: Action };
}) {
  const savedLine = saved && Object.hasOwn(SAVED, saved) ? SAVED[saved] : undefined;
  return (
    <div className="flex flex-col gap-6">
      <FormError code={error} messages={ERRORS} />
      {savedLine && <p role="status" className="rounded-lg bg-success-bg px-3 py-2 text-sm text-accent-green">{savedLine}</p>}

      <form action={actions.rename} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={collection.id} />
        <label className={label}>
          Name
          <input name="name" required defaultValue={collection.name} className={input} />
        </label>
        <label className={label}>
          Notes
          <textarea name="notes" rows={2} defaultValue={collection.notes ?? ''} className={input} />
        </label>
        <button type="submit" className={`${primaryButton} self-start`}>Save</button>
      </form>

      <section aria-labelledby="sharing" className="flex flex-col gap-3">
        <h2 id="sharing" className="font-display text-base font-semibold">Shared with</h2>
        {shares.length === 0 ? (
          <p className="text-sm text-text-muted">{collection.name} isn’t shared with anyone yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
            {shares.map((p) => (
              <li key={p.id} className="flex flex-col gap-1 px-3 py-2">
                <span className="text-sm text-text">{p.name ?? p.email}</span>
                {p.name && <span className="break-all font-mono text-xs text-text-muted">{p.email}</span>}
                <details>
                  <summary className={`${quietButton} cursor-pointer`}>Remove</summary>
                  <form action={actions.unshare} className="mt-2">
                    <input type="hidden" name="id" value={collection.id} />
                    <input type="hidden" name="userId" value={p.id} />
                    <button type="submit" className={quietButton} aria-label={`Stop sharing with ${p.name ?? p.email}`}>Stop sharing</button>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        )}
        {candidates.length === 0 ? (
          <p className="text-sm text-text-muted">Everyone approved already has it.</p>
        ) : (
          <form action={actions.share} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="id" value={collection.id} />
            <label className={`${label} min-w-0 flex-1`}>
              Share with
              <select name="userId" defaultValue="" className={input}>
                <option value="" disabled>Pick someone</option>
                {candidates.map((p) => <option key={p.id} value={p.id}>{describe(p)}</option>)}
              </select>
            </label>
            <button type="submit" className={primaryButton}>Share</button>
          </form>
        )}
        <p className="text-xs text-text-muted">
          People it’s shared with can see and add to it: albums, copies, locations and wants. Only its owner (or an admin) can rename it or change who has it.
        </p>
      </section>
    </div>
  );
}
