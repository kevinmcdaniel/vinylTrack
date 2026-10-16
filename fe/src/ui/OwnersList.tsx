import type { OwnerRow } from '@/lib/types';
import FormError from './FormError';

type Action = (formData: FormData) => Promise<void>;

const MESSAGES = {
  'invalid': 'Give the owner a name.',
  'in-use': 'That owner still owns copies. Give them to someone else first.',
  'forbidden': 'Only an admin can do that.',
  'not-found': 'That owner no longer exists.',
};

const input = 'min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-sm text-text';
const primaryButton = 'rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-text';
const quietButton = 'text-sm text-primary underline';

/**
 * Add, rename and (admins only) delete owners (#102). Plain forms posting to
 * Server Actions, so it works before any JS loads; rename sits behind a
 * <details> to keep each row to one line.
 */
export default function OwnersList({ owners, canDelete, error, actions }: {
  owners: OwnerRow[];
  canDelete: boolean;
  error?: string;
  actions: { create: Action; rename: Action; remove: Action };
}) {
  return (
    <div className="flex flex-col gap-4">
      <FormError code={error} messages={MESSAGES} />

      <form action={actions.create} className="flex gap-2">
        <label className="sr-only" htmlFor="new-owner">New owner&rsquo;s name</label>
        <input id="new-owner" name="name" required placeholder="Name, e.g. Grandma Ruth" className={input} />
        <button type="submit" className={primaryButton}>Add owner</button>
      </form>

      {owners.length === 0 ? (
        <p className="text-sm text-text-muted">No owners yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
          {owners.map((owner) => (
            <li key={owner.id} className="flex flex-col gap-2 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-text">{owner.name}</span>
                <span className="text-xs text-text-muted">{owner.userId ? 'Linked to an account' : 'No account'}</span>
              </div>
              <div className="flex items-start gap-4">
                <details className="flex-1">
                  <summary className={`${quietButton} cursor-pointer`}>Rename</summary>
                  <form action={actions.rename} className="mt-2 flex gap-2">
                    <input type="hidden" name="id" value={owner.id} />
                    <label className="sr-only" htmlFor={`rename-${owner.id}`}>New name for {owner.name}</label>
                    <input id={`rename-${owner.id}`} name="name" required defaultValue={owner.name} className={input} />
                    <button type="submit" className={primaryButton}>Save</button>
                  </form>
                </details>
                {canDelete && (
                  <form action={actions.remove}>
                    <input type="hidden" name="id" value={owner.id} />
                    <button type="submit" className={quietButton} aria-label={`Delete ${owner.name}`}>Delete</button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
