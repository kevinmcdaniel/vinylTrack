import Link from 'next/link';
import { ApiError, apiGet } from '@/lib/api';
import { getCurrentUser } from '@/lib/session';
import type { AdminSummary } from '@/lib/types';
import { signOutAction } from '@/app/pending/actions';
import { getThemeChoice } from '@/lib/themeChoice';
import ThemePicker from './ThemePicker';

/**
 * Header links for the signed-in user. Display only: every page still checks
 * access through lib/session.ts next to its data (Next's guidance: no auth
 * checks in layouts). Rendered inside <Suspense> so the shell streams first.
 */
export default async function UserMenu() {
  const [user, theme] = await Promise.all([getCurrentUser(), getThemeChoice()]);
  // Admins only, and a BE failure just drops the badge: this renders on every page.
  const pending = user.isAdmin && user.status === 'active'
    ? await apiGet<AdminSummary>('/admin/summary').then((s) => s.pendingUsers, (error: unknown) => {
      // A redirect (session gone mid-render) must still fire.
      if (error instanceof ApiError) return 0;
      throw error;
    })
    : 0;
  return (
    <nav className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 whitespace-nowrap text-xs">
      <Link href="/collection/new" className="underline">New collection</Link>
      <Link href="/owners" className="underline">Owners</Link>
      <Link href="/help" className="underline">Help</Link>
      {user.isAdmin && (
        <Link href="/admin" className="underline">
          Admin
          {pending > 0 && (
            <>
              <span aria-hidden className="ml-1 inline-block rounded-full bg-primary px-1.5 font-mono text-[10px] text-primary-text no-underline">{pending}</span>
              <span className="sr-only">, {pending} pending</span>
            </>
          )}
        </Link>
      )}
      <ThemePicker current={theme} />
      <span className="opacity-70">{user.name ?? user.email}</span>
      <form action={signOutAction}>
        <button type="submit" className="underline">Sign out</button>
      </form>
    </nav>
  );
}
