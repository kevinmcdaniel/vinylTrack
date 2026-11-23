import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { requireAdmin } from '@/lib/session';
import type { OwnerRow, UserRow } from '@/lib/types';
import UsersList from '@/ui/UsersList';
import { denyUser } from './actions';

export const dynamic = 'force-dynamic';

/** Admin: every account, so "which one is this?" has an answer (#124). */
export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireAdmin();
  const [users, owners, { error }] = await Promise.all([
    apiGet<UserRow[]>('/user'),
    apiGet<OwnerRow[]>('/owner'),
    searchParams,
  ]);
  return (
    <section className="flex flex-col gap-4">
      <Link href="/admin" className="text-sm text-primary underline">← Admin</Link>
      <h1 className="font-display text-lg font-semibold">Users</h1>
      <p className="text-sm text-text-muted">Every account that has signed in. The email is what makes each one unique.</p>
      <UsersList users={users} owners={owners} meId={me.id} error={typeof error === 'string' ? error : undefined} denyAction={denyUser} />
    </section>
  );
}
