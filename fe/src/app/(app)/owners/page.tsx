import { apiGet } from '@/lib/api';
import { requireActiveUser } from '@/lib/session';
import type { OwnerRow } from '@/lib/types';
import OwnersList from '@/ui/OwnersList';
import { createOwner, deleteOwner, renameOwner } from './actions';

export const dynamic = 'force-dynamic';

/** Owners (#102): who a copy can belong to, with or without an account. */
export default async function OwnersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireActiveUser();
  const [owners, { error }] = await Promise.all([apiGet<OwnerRow[]>('/owner'), searchParams]);
  return (
    <section className="flex flex-col gap-4">
      <h1 className="font-display text-lg font-semibold">Owners</h1>
      <p className="text-sm text-text-muted">
        Everyone a record can belong to. An owner doesn&rsquo;t need an account: an admin links one when that person signs in.
      </p>
      <OwnersList
        owners={owners}
        canDelete={user.isAdmin}
        error={typeof error === 'string' ? error : undefined}
        actions={{ create: createOwner, rename: renameOwner, remove: deleteOwner }}
      />
    </section>
  );
}
