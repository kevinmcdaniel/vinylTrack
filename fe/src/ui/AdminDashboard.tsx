import Link from 'next/link';
import type { AdminHealth, AdminSummary, WorkloadHealth } from '@/lib/types';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const STATUS_TAG: Record<WorkloadHealth['status'], string> = {
  'up': 'bg-success-bg text-accent-green',
  'down': 'bg-danger-bg text-danger-text',
  'not configured': 'bg-surface-alt text-text-tertiary',
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="font-mono text-[11px] uppercase tracking-[1.5px] text-text-muted">{title}</h2>
      {children}
    </section>
  );
}

const card = 'rounded-xl border border-border bg-surface';

function detailLine(name: string, w: WorkloadHealth): string {
  const parts = [w.detail, w.version, w.mode];
  if (name === 'db' && w.latencyMs !== undefined) parts.push(`${w.latencyMs} ms`);
  if (w.uptimeSeconds !== undefined) parts.push(`up ${Math.floor(w.uptimeSeconds / 3600)}h ${Math.floor((w.uptimeSeconds % 3600) / 60)}m`);
  return parts.filter(Boolean).join(' · ');
}

function Workload({ name, health }: { name: string; health: WorkloadHealth }) {
  const detail = detailLine(name, health);
  return (
    <li className="flex flex-col gap-1 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-mono text-sm font-semibold">{name}</h3>
        <span className={`rounded-full px-2 font-mono text-[10px] font-semibold ${STATUS_TAG[health.status]}`}>{health.status}</span>
      </div>
      {detail && <p className="font-mono text-xs text-text-muted">{detail}</p>}
      {name === 'mailer' && health.status === 'down' && (
        <p className="text-xs text-text-muted">
          Releases are blocked until it is healthy. If the Gmail grant was revoked,{' '}
          <Link href="/docs/hosting-maintenance" className="text-primary underline">re-authorize it (runbook)</Link>.
        </p>
      )}
    </li>
  );
}

/**
 * Admin back office (#90): what needs doing, what's running, and where the
 * runbooks are. `health` is null when the check itself failed.
 */
export default function AdminDashboard({ summary, health, feVersion }: {
  summary: AdminSummary;
  health: AdminHealth | null;
  feVersion: string;
}) {
  // An owner with no account is normal (#53); it only matters while someone
  // is waiting to be approved and could be linked to it.
  const allClear = summary.pendingUsers === 0;
  const workloads: [string, WorkloadHealth][] = [
    ['fe', { status: 'up', version: feVersion }],
    ...(health ? [['be', health.be], ['db', health.db], ['mailer', health.mailer]] as [string, WorkloadHealth][] : []),
  ];
  // A half-finished deploy leaves services on different tags.
  const versions = new Set(workloads.map(([, w]) => w.version).filter(Boolean));

  return (
    <div className="flex flex-col gap-6">
      <Section id="admin-actions" title="Action items">
        {allClear ? (
          <p className="text-sm text-text-muted">All clear.</p>
        ) : (
          <div className={`${card} flex flex-col gap-1 px-3 py-2 text-sm`}>
            <Link href="/admin/requests" className="text-primary underline">
              {plural(summary.pendingUsers, 'access request', 'access requests')} waiting
            </Link>
            {summary.unlinkedOwners > 0 && (
              <p className="text-text-muted">
                {plural(summary.unlinkedOwners, 'owner', 'owners')} with no linked account, to link on approve.
              </p>
            )}
          </div>
        )}
      </Section>

      <Section id="admin-accounts" title="Accounts">
        <p className="text-sm">
          <Link href="/admin/users" className="text-primary underline">Users</Link>
          <span className="text-text-muted"> · everyone who has signed in, by email</span>
        </p>
      </Section>

      <Section id="admin-workloads" title="Workloads">
        {versions.size > 1 && (
          <p role="alert" className="rounded-lg border border-warn-border bg-warn-bg p-3 text-sm text-warn-text">
            Versions differ ({[...versions].join(', ')}). A deploy may be half finished.
          </p>
        )}
        <ul className={`${card} divide-y divide-border`}>
          {workloads.map(([name, w]) => <Workload key={name} name={name} health={w} />)}
        </ul>
        {!health && <p className="text-sm text-text-muted">Couldn&apos;t check be, db or mailer. Try again in a moment.</p>}
      </Section>

      <Section id="admin-runbooks" title="Runbooks">
        <ul className="flex flex-col gap-1 text-sm">
          <li><Link href="/docs/hosting-deploy" className="text-primary underline">Releasing and deploying</Link></li>
          <li><Link href="/docs/hosting-maintenance" className="text-primary underline">Server maintenance and rotation</Link></li>
          <li><Link href="/docs" className="text-primary underline">All docs</Link></li>
        </ul>
      </Section>
    </div>
  );
}
