import { ApiError, apiGet } from '@/lib/api';
import { getConfig } from '@/lib/config';
import { requireAdmin } from '@/lib/session';
import type { AdminHealth, AdminSummary } from '@/lib/types';
import AdminDashboard from '@/ui/AdminDashboard';

export const dynamic = 'force-dynamic';

/** Admin back office (#90). Health is best-effort: action items still show without it. */
export default async function AdminPage() {
  await requireAdmin();
  const [summary, health] = await Promise.all([
    apiGet<AdminSummary>('/admin/summary'),
    apiGet<AdminHealth>('/admin/health').catch((error: unknown) => {
      if (error instanceof ApiError) return null;
      throw error;
    }),
  ]);
  return (
    <section className="flex flex-col gap-4">
      <h1 className="font-display text-xl font-bold">Admin</h1>
      <AdminDashboard summary={summary} health={health} feVersion={getConfig().version} />
    </section>
  );
}
