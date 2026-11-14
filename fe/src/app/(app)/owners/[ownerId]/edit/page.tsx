import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiGet, ApiError } from '@/lib/api';
import { requireActiveUser } from '@/lib/session';
import type { OwnerRow } from '@/lib/types';
import FormError from '@/ui/FormError';
import { OWNER_MESSAGES, ownerInput, ownerPrimaryButton } from '@/ui/OwnersList';
import { deleteOwner, renameOwner } from '../../actions';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ ownerId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Rename an owner, and (admins only) delete one (#102, #137). Delete sits in
 * a closed <details>, a deliberate second tap away (PR #110 review).
 */
export default async function EditOwnerPage({ params, searchParams }: Props) {
  const [{ ownerId }, { error }, user] = await Promise.all([params, searchParams, requireActiveUser()]);
  let owner: OwnerRow;
  try {
    owner = await apiGet<OwnerRow>(`/owner/${encodeURIComponent(ownerId)}`);
  } catch (e) {
    if (e instanceof ApiError && e.notFound) notFound();
    throw e;
  }
  return (
    <section className="flex flex-col gap-4">
      <div>
        <Link href="/owners" className="text-sm text-primary underline">← Owners</Link>
        <h1 className="mt-2 font-display text-lg font-semibold">Edit {owner.name}</h1>
        {owner.userId && <p className="text-sm text-text-muted">Linked to an account.</p>}
      </div>
      <FormError code={typeof error === 'string' ? error : undefined} messages={OWNER_MESSAGES} />
      <form action={renameOwner} className="flex gap-2">
        <input type="hidden" name="id" value={owner.id} />
        <label className="sr-only" htmlFor="owner-name">Name</label>
        <input id="owner-name" name="name" required defaultValue={owner.name} className={ownerInput} />
        <button type="submit" className={ownerPrimaryButton}>Save</button>
      </form>
      {user.isAdmin && (
        <details>
          <summary className="cursor-pointer text-sm text-primary underline">Delete…</summary>
          <form action={deleteOwner} className="mt-2">
            <input type="hidden" name="id" value={owner.id} />
            <button type="submit" className="text-sm text-primary underline" aria-label={`Delete ${owner.name}`}>Delete</button>
          </form>
        </details>
      )}
    </section>
  );
}
