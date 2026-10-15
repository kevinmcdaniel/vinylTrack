import Link from 'next/link';
import { getCurrentUser } from '@/lib/session';
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
  return (
    <nav className="flex items-center gap-3 text-xs">
      <Link href="/collection/new" className="underline">New collection</Link>
      <Link href="/help" className="underline">Help</Link>
      {user.isAdmin && <Link href="/admin/requests" className="underline">Requests</Link>}
      <ThemePicker current={theme} />
      <span className="opacity-70">{user.name ?? user.email}</span>
      <form action={signOutAction}>
        <button type="submit" className="underline">Sign out</button>
      </form>
    </nav>
  );
}
