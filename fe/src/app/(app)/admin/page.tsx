import { ApiError, apiGet } from '@/lib/api';
import { getConfig } from '@/lib/config';
import { requireAdmin } from '@/lib/session';
import type { AdminHealth, AdminSummary } from '@/lib/types';
import AdminDashboard from '@/ui/AdminDashboard';

export const dynamic = 'force-dynamic';

// A BE that errors or can't be reached is what this page exists to show, so
// it renders as "down" instead of failing the page. A TypeError is fetch's
// "unreachable"; anything else (a redirect included) still propagates.
const orNull = <T,>(p: Promise<T>): Promise<T | null> =>
  p.catch((error: unknown) => {
    if (error instanceof ApiError || error instanceof TypeError) return null;
    throw error;
  });

/** Admin back office (#90): what needs doing, the running release, workload health. */
export default async function AdminPage() {
  await requireAdmin();
  const [summary, health] = await Promise.all([
    orNull(apiGet<AdminSummary>('/admin/summary')),
    orNull(apiGet<AdminHealth>('/admin/health')),
  ]);
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Admin</h1>
      <AdminDashboard summary={summary} health={health} feVersion={getConfig().version} />
    </section>
  );
}
