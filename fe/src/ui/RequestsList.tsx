type Action = (formData: FormData) => Promise<void>;
export type PendingUser = { id: string; email: string; name: string | null; avatar: string | null; status: 'pending'; isAdmin: boolean; createdAt: string };
export type LinkableOwner = { id: string; name: string };

// ?error= is user-controlled, so it only ever picks one of these.
const ERRORS: Record<string, string> = {
  conflict: 'That owner is already linked to someone else. Pick another, or don\u2019t link.',
  gone: 'That request is no longer there. Someone may have handled it already.',
};

/** Admin: access requests waiting for a decision (#73). */
export default function RequestsList({
  users, owners, error, approveAction, denyAction,
}: { users: PendingUser[]; owners: LinkableOwner[]; error?: string; approveAction: Action; denyAction: Action }) {
  const alert = error && (
    <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm">
      {Object.hasOwn(ERRORS, error) ? ERRORS[error] : 'We couldn\u2019t update that request. Please try again.'}
    </p>
  );
  if (users.length === 0) return <>{alert}<p className="text-sm opacity-70">No one is waiting for approval.</p></>;
  return (
    <>
      {alert}
      <ul className="flex flex-col gap-3">
        {users.map((u) => (
          <li key={u.id} className="flex flex-col gap-2 rounded-md border border-black/10 p-3 dark:border-white/15">
            <div>
              <p className="text-sm font-medium">{u.name ?? u.email}</p>
              <p className="text-xs opacity-70">{u.email}</p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <form action={approveAction} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="userId" value={u.id} />
                <label className="flex flex-col gap-1 text-xs">
                  Link to owner
                  <select name="ownerId" defaultValue="" className="rounded border border-black/20 bg-transparent px-2 py-1 text-sm dark:border-white/25">
                    <option value="">Don&apos;t link</option>
                    {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </label>
                <button type="submit" className="rounded-md bg-text px-3 py-1 text-sm text-bg">Approve</button>
              </form>
              <form action={denyAction}>
                <input type="hidden" name="userId" value={u.id} />
                <button type="submit" className="rounded-md border border-black/20 px-3 py-1 text-sm dark:border-white/25">Deny</button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
