import Link from 'next/link';
import type { OwnerRow } from '@/lib/types';
import FormError from './FormError';
import ListRow from './ListRow';
import RowFilter from './RowFilter';

type Action = (formData: FormData) => Promise<void>;

export const OWNER_MESSAGES = {
  'invalid': 'Give the owner a name.',
  'in-use': 'That owner still owns copies. Give them to someone else first.',
  'forbidden': 'Only an admin can do that.',
  'not-found': 'That owner no longer exists.',
};

export const ownerInput = 'min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-sm text-text';
export const ownerPrimaryButton = 'rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-text';

/**
 * Add owners, and one line per owner with an Edit link (#102, #137). Rename and
 * delete live on `/owners/[id]/edit`. A plain form, so it works before JS loads.
 */
export default function OwnersList({ owners, error, actions }: {
  owners: OwnerRow[];
  error?: string;
  actions: { create: Action };
}) {
  return (
    <div className="flex flex-col gap-4">
      <FormError code={error} messages={OWNER_MESSAGES} />

      <form action={actions.create} className="flex gap-2">
        <label className="sr-only" htmlFor="new-owner">New owner&rsquo;s name</label>
        <input id="new-owner" name="name" required placeholder="Name, e.g. Grandma Ruth" className={ownerInput} />
        <button type="submit" className={ownerPrimaryButton}>Add owner</button>
      </form>

      {owners.length === 0 ? (
        <p className="text-sm text-text-muted">No owners yet.</p>
      ) : (
        <RowFilter label="Filter owners" count={owners.length}>
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
            {owners.map((owner) => (
              <ListRow
                key={owner.id}
                filterText={owner.name}
                meta={owner.userId ? 'Linked to an account' : undefined}
                action={<Link href={`/owners/${encodeURIComponent(owner.id)}/edit`} className="text-primary underline" aria-label={`Edit ${owner.name}`}>Edit</Link>}
              >
                {owner.name}
              </ListRow>
            ))}
          </ul>
        </RowFilter>
      )}
    </div>
  );
}
