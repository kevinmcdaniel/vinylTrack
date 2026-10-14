import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { getCurrentUser } from '@/lib/session';
import type { AdminSummary } from '@/lib/types';
import { signOutAction } from '@/app/pending/actions';

// Two counts on the BE; non-admins never pay for it. A failure costs the
// badge, not the header every page renders.
const pendingCount = async (): Promise<number> => {
  try {
    return (await apiGet<AdminSummary>('/admin/summary')).pendingUsers;
  } catch {
    return 0;
  }
};

/**
 * Header links for the signed-in user. Display only: every page still checks
 * access through lib/session.ts next to its data (Next's guidance: no auth
 * checks in layouts). Rendered inside <Suspense> so the shell streams first.
 * The name hides below `sm` so the links fit a 375px phone.
 */
export default async function UserMenu() {
  const user = await getCurrentUser();
  const admin = user.isAdmin && user.status === 'active';
  const pending = admin ? await pendingCount() : 0;
  return (
    <nav className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-xs">
      <Link href="/collection/new" className="underline">New collection</Link>
      <Link href="/help" className="underline">Help</Link>
      {admin && (
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 underline"
          aria-label={pending > 0 ? `Admin, ${pending} pending ${pending === 1 ? 'request' : 'requests'}` : undefined}
        >
          Admin
          {pending > 0 && (
            <span className="rounded-full bg-red-600 px-1.5 text-[10px] font-semibold leading-4 text-white no-underline">{pending}</span>
          )}
        </Link>
      )}
      <span className="hidden opacity-70 sm:inline">{user.name ?? user.email}</span>
      <form action={signOutAction}>
        <button type="submit" className="underline">Sign out</button>
      </form>
    </nav>
  );
}
