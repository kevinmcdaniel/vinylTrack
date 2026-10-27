import Link from 'next/link';
import { ApiError, apiGet } from '@/lib/api';
import { getConfig } from '@/lib/config';
import { getCurrentUser } from '@/lib/session';
import type { AdminSummary, OwnerRow } from '@/lib/types';
import { signOutAction } from '@/app/pending/actions';
import { getThemeChoice } from '@/lib/themeChoice';
import MenuDisclosure from './MenuDisclosure';
import ThemePicker from './ThemePicker';

// A BE hiccup only drops a detail: this renders on every page. A redirect
// (session gone mid-render) must still fire.
const orElse = <T,>(fallback: T) => (error: unknown): T => {
  if (error instanceof ApiError) return fallback;
  throw error;
};

const sectionLabel = 'font-mono text-[10px] uppercase tracking-[1.5px] text-text-muted';
const menuLink = 'text-primary underline';

function Badge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <>
      <span aria-hidden className="ml-1 inline-block rounded-full bg-primary px-1.5 font-mono text-[10px] text-primary-text no-underline">{count}</span>
      <span className="sr-only">, {count} pending</span>
    </>
  );
}

/**
 * Header for the signed-in user (#124): Want list stays one tap away, the
 * rest sits in an account menu under your name, which says which account
 * this is (the email is the unique key). Display only: every page still
 * checks access through lib/session.ts next to its data (Next's guidance: no
 * auth checks in layouts). Rendered inside <Suspense> so the shell streams first.
 */
export default async function UserMenu() {
  const [user, theme] = await Promise.all([getCurrentUser(), getThemeChoice()]);
  const admin = user.isAdmin && user.status === 'active';
  // Non-admins never ask for the admin summary.
  const [pending, owners] = await Promise.all([
    admin ? apiGet<AdminSummary>('/admin/summary').then((s) => s.pendingUsers, orElse(0)) : 0,
    apiGet<OwnerRow[]>('/owner').catch(orElse([] as OwnerRow[])),
  ]);
  const owner = owners.find((o) => o.userId === user.id);
  const { version, publicHostname } = getConfig();

  return (
    <nav className="flex items-center gap-3 whitespace-nowrap text-xs">
      <Link href="/wants" className="underline">Want list</Link>
      <MenuDisclosure
        label={`Account menu, ${user.name ?? user.email}`}
        summary={<><span className="max-w-[10rem] truncate">{user.name ?? user.email}</span>{admin && <Badge count={pending} />}</>}
      >
        <div className="flex flex-col gap-0.5 whitespace-normal">
          {user.name && <p className="font-medium">{user.name}</p>}
          <p className="break-all font-mono text-xs text-text-muted">{user.email}</p>
          <p className="text-xs text-text-muted">{user.isAdmin ? 'Admin' : 'Member'}</p>
          {owner && <p className="text-xs text-text-muted">Owns records as {owner.name}</p>}
        </div>
        <ul className="flex flex-col gap-1.5">
          <li><Link href="/collection/new" className={menuLink}>New collection</Link></li>
          <li><Link href="/owners" className={menuLink}>Owners</Link></li>
          <li><Link href="/help" className={menuLink}>Help</Link></li>
        </ul>
        <label className="flex items-center justify-between gap-2 text-xs text-text-muted">
          Theme
          <ThemePicker current={theme} />
        </label>
        {admin && (
          <div className="flex flex-col gap-1.5 border-t border-border pt-3">
            <p className={sectionLabel}>Admin</p>
            <ul className="flex flex-col gap-1.5">
              <li><Link href="/admin" className={menuLink}>Admin</Link></li>
              <li><Link href="/admin/users" className={menuLink}>Users</Link></li>
              <li><Link href="/admin/requests" className={menuLink}>Access requests<Badge count={pending} /></Link></li>
            </ul>
            <p className="font-mono text-[10px] text-text-muted">{version} · {publicHostname}</p>
          </div>
        )}
        <form action={signOutAction} className="border-t border-border pt-3">
          <button type="submit" className={menuLink}>Sign out</button>
        </form>
      </MenuDisclosure>
    </nav>
  );
}
