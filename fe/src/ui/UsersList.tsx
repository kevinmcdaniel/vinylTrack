import Link from 'next/link';
import type { OwnerRow, UserRow } from '@/lib/types';
import FormError from './FormError';

type Action = (formData: FormData) => Promise<void>;

const MESSAGES = {
  'in-use': 'You can’t change your own access.',
  'forbidden': 'Only an admin can do that.',
  'not-found': 'That account no longer exists.',
};

const STATUS: Record<UserRow['status'], string> = { active: 'Active', pending: 'Pending', denied: 'Denied' };
const tag = 'rounded-full border border-border px-2 text-[10px] font-semibold text-text-muted';
const quietButton = 'text-sm text-primary underline';

/**
 * Admin: every account, whatever its status (#124). Two accounts can share a
 * name, so the email (the unique key) is always shown. Pending accounts are
 * decided on /admin/requests; an active one can be denied from here, behind
 * a closed <details>, and never your own (the BE refuses that too).
 */
export default function UsersList({ users, owners, meId, error, denyAction }: {
  users: UserRow[];
  owners: Pick<OwnerRow, 'id' | 'name' | 'userId'>[];
  meId: string;
  error?: string;
  denyAction: Action;
}) {
  const ownerOf = new Map(owners.filter((o) => o.userId).map((o) => [o.userId, o.name]));
  return (
    <div className="flex flex-col gap-3">
      <FormError code={error} messages={MESSAGES} />
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
        {users.map((u) => {
          const owner = ownerOf.get(u.id);
          return (
            <li key={u.id} className="flex flex-col gap-1 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{u.name ?? u.email}</span>
                <span className={tag}>{STATUS[u.status]}</span>
                {u.isAdmin && <span className={tag}>Admin</span>}
                {u.id === meId && <span className={tag}>You</span>}
              </div>
              {u.name && <p className="break-all font-mono text-xs text-text-muted">{u.email}</p>}
              {owner && <p className="text-xs text-text-muted">Owns records as {owner}</p>}
              {u.status === 'pending' && (
                <Link href="/admin/requests" className={quietButton}>Review request</Link>
              )}
              {u.status === 'active' && u.id !== meId && (
                <details>
                  <summary className={`${quietButton} cursor-pointer`}>Remove access</summary>
                  <form action={denyAction} className="mt-2">
                    <input type="hidden" name="userId" value={u.id} />
                    <button type="submit" className={quietButton} aria-label={`Deny ${u.email}`}>Deny</button>
                  </form>
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
