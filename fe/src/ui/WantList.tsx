import Link from 'next/link';
import type { WantItem } from '@/lib/types';
type Action = (formData: FormData) => Promise<void>;
type Actions = { update: Action; remove: Action };

const input = 'rounded-md border border-border bg-surface px-2 py-1 text-sm text-text';
import { groupWants, matchLines, wantArtists, wantTitle } from '@/lib/wants';

/**
 * Must-have, then nice-to-have (#8). Each row carries its duplicate check
 * (#13): who already has it and where, or which collection came up empty, so
 * "nobody has it" never claims more than what is shared with you.
 */
export default function WantList({
  wants,
  collectionNames,
  showCollection,
  back,
  myOwnerId,
  actions,
}: {
  wants: WantItem[];
  collectionNames: Map<string, string>;
  showCollection: boolean;
  /** The URL Edit/Delete return to, so a filtered view stays filtered. */
  back: string;
  /** The caller's own owner row, so their copies read "You have …". */
  myOwnerId?: string;
  actions: Actions;
}) {
  if (wants.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-text-muted">
        Nothing on the want list.
      </p>
    );
  }
  const { mustHave, niceToHave } = groupWants(wants);
  return (
    <div className="flex flex-col gap-6">
      <Group title="Must-have" wants={mustHave} collectionNames={collectionNames} showCollection={showCollection} back={back} myOwnerId={myOwnerId} actions={actions} />
      <Group title="Nice-to-have" wants={niceToHave} collectionNames={collectionNames} showCollection={showCollection} back={back} myOwnerId={myOwnerId} actions={actions} />
    </div>
  );
}

function Group({
  title,
  wants,
  collectionNames,
  showCollection,
  back,
  myOwnerId,
  actions,
}: {
  title: string;
  wants: WantItem[];
  collectionNames: Map<string, string>;
  showCollection: boolean;
  back: string;
  myOwnerId?: string;
  actions: Actions;
}) {
  if (wants.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        {title} <span className="font-mono">({wants.length})</span>
      </h2>
      <ul className="flex flex-col gap-2">
        {wants.map((want) => {
          const lines = matchLines(want, myOwnerId);
          const collection = collectionNames.get(want.collectionId) ?? 'this collection';
          const artists = wantArtists(want);
          return (
            <li key={want.id} className="rounded-xl border border-border bg-surface p-3">
              <p className="font-medium leading-snug text-text">{wantTitle(want)}</p>
              {artists && <p className="text-sm text-text-secondary">{artists}</p>}
              {showCollection && <p className="mt-0.5 text-xs text-text-muted">{collection}</p>}
              {want.notes && <p className="mt-1 text-sm text-text-muted">{want.notes}</p>}
              {lines.length > 0 ? (
                <ul className="mt-2 flex flex-col gap-1 rounded-lg bg-warn-bg px-2 py-1.5 text-sm text-warn-text">
                  {lines.map((line) => <li key={line}>{line}</li>)}
                </ul>
              ) : (
                <p className="mt-2 rounded-lg bg-surface-alt px-2 py-1.5 text-sm text-text-tertiary">No copies in {collection}</p>
              )}
              <div className="mt-2 flex items-start gap-4">
                <Link href={`/want/${encodeURIComponent(want.id)}/found`} className="text-sm font-medium text-primary underline">Found it</Link>
                <EditWant want={want} back={back} actions={actions} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Priority and notes behind a disclosure; Delete a second tap away inside it (#102 rule). */
function EditWant({ want, back, actions }: { want: WantItem; back: string; actions: Actions }) {
  const name = wantTitle(want);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-primary underline">Edit</summary>
      <form action={actions.update} className="mt-2 flex flex-col gap-2">
        <input type="hidden" name="id" value={want.id} />
        <input type="hidden" name="back" value={back} />
        <fieldset className="flex gap-4 text-text">
          <legend className="sr-only">Priority for {name}</legend>
          <label className="flex items-center gap-1.5">
            <input type="radio" name="priority" value="must-have" defaultChecked={want.priority === 'must-have'} /> Must-have
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" name="priority" value="nice-to-have" defaultChecked={want.priority !== 'must-have'} /> Nice-to-have
          </label>
        </fieldset>
        <label className="flex flex-col gap-1 text-text">
          Notes
          <textarea name="notes" rows={2} defaultValue={want.notes ?? ''} className={input} />
        </label>
        <button type="submit" className="self-start rounded-md bg-primary px-3 py-1.5 font-medium text-primary-text">Save</button>
      </form>
      <details className="mt-2">
        <summary className="cursor-pointer text-danger-text underline">Delete…</summary>
        <form action={actions.remove} className="mt-2">
          <input type="hidden" name="id" value={want.id} />
          <input type="hidden" name="back" value={back} />
          <button type="submit" aria-label={`Delete ${name}`} className="rounded-md border border-border bg-surface px-3 py-1.5 text-danger-text">
            Delete from the want list
          </button>
        </form>
      </details>
    </details>
  );
}
