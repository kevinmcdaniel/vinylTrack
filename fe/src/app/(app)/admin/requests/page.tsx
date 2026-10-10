import { apiGet } from '@/lib/api';
import { requireAdmin } from '@/lib/session';
import RequestsList, { type LinkableOwner, type PendingUser } from '@/ui/RequestsList';
import { approveRequest, denyRequest } from './actions';

export const dynamic = 'force-dynamic';

export default async function RequestsPage() {
  await requireAdmin();
  const [users, owners] = await Promise.all([
    apiGet<PendingUser[]>('/user', { status: 'pending' }),
    apiGet<(LinkableOwner & { userId: string | null })[]>('/owner'),
  ]);
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Access requests</h1>
      <RequestsList
        users={users}
        owners={owners.filter((o) => !o.userId).map(({ id, name }) => ({ id, name }))}
        approveAction={approveRequest}
        denyAction={denyRequest}
      />
    </section>
  );
}
