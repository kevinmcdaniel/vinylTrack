import Link from 'next/link';
import type { AdminHealth, AdminSummary } from '@/lib/types';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

type Workload = { name: string; state: 'up' | 'down' | 'not configured'; detail?: string; note?: React.ReactNode };

const STATE_CLASS: Record<Workload['state'], string> = {
  up: 'text-green-700 dark:text-green-400',
  down: 'font-semibold text-red-700 dark:text-red-400',
  'not configured': 'opacity-70',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const id = `admin-${title.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function ToDo({ summary }: { summary: AdminSummary | null }) {
  if (!summary) return <p className="text-sm opacity-70">Couldn&apos;t load the action items.</p>;
  const items: React.ReactNode[] = [];
  if (summary.pendingUsers > 0) {
    items.push(
      <Link href="/admin/requests" className="underline">{plural(summary.pendingUsers, 'access request')}</Link>,
    );
  }
  if (summary.unlinkedOwners > 0) {
    items.push(<>{plural(summary.unlinkedOwners, 'owner')} with no account. Link one when you approve its person.</>);
  }
  if (items.length === 0) return <p className="text-sm opacity-70">All clear.</p>;
  return (
    <ul className="flex flex-col gap-1 text-sm">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  );
}

/**
 * Admin back office (#90): what needs doing, the running release, and each
 * workload's health. `health`/`summary` are null when the BE did not answer,
 * which is itself the answer: the be is down.
 */
export default function AdminDashboard({
  summary, health, feVersion,
}: { summary: AdminSummary | null; health: AdminHealth | null; feVersion: string }) {
  const mailer = health?.mailer;
  const workloads: Workload[] = [
    { name: 'fe', state: 'up', detail: feVersion },
    health
      ? { name: 'be', state: 'up', detail: health.be.version }
      : { name: 'be', state: 'down', detail: 'no answer' },
    health
      ? health.db.status === 'up'
        ? { name: 'db', state: 'up', detail: `${health.db.latencyMs} ms` }
        : { name: 'db', state: 'down', detail: health.db.detail }
      : { name: 'db', state: 'down', detail: 'unknown' },
    !mailer
      ? { name: 'mailer', state: 'down', detail: 'unknown' }
      : mailer.status === 'down'
        ? {
            name: 'mailer', state: 'down', detail: [mailer.detail, mailer.mode].filter(Boolean).join(', '),
            // A down mailer blocks releases (#62) and usually means a lapsed Gmail grant.
            note: <Link href="/docs/hosting-maintenance" className="underline">Re-authorize the Gmail grant (Rotation → Mailer token)</Link>,
          }
        : { name: 'mailer', state: mailer.status, detail: mailer.mode },
  ];

  // A half-finished deploy shows up as workloads on different releases.
  const versions = [
    { name: 'fe', version: feVersion },
    ...(health ? [{ name: 'be', version: health.be.version }] : []),
    ...(mailer?.version ? [{ name: 'mailer', version: mailer.version }] : []),
  ];
  const mismatch = new Set(versions.map((v) => v.version)).size > 1;

  return (
    <div className="flex flex-col gap-6">
      <Section title="To do">
        <ToDo summary={summary} />
      </Section>

      <Section title="Version">
        {mismatch && (
          <p role="alert" className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
            Versions differ: a deploy may not have finished.
          </p>
        )}
        {mismatch ? (
          <ul className="flex flex-col gap-1 text-sm">
            {versions.map((v) => <li key={v.name}>{v.name}: <span>{v.version}</span></li>)}
          </ul>
        ) : (
          <p className="text-sm"><span>{feVersion}</span></p>
        )}
      </Section>

      <Section title="Workloads">
        <ul className="flex flex-col gap-2">
          {workloads.map((w) => (
            <li key={w.name} aria-label={w.name} className="flex flex-col gap-1 rounded-md border border-black/10 p-3 text-sm dark:border-white/15">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{w.name}</span>
                <span className={STATE_CLASS[w.state]}>{w.state}</span>
              </div>
              {w.detail && <span className="text-xs opacity-70">{w.detail}</span>}
              {w.note && <span className="text-xs">{w.note}</span>}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Runbooks">
        <ul className="flex flex-col gap-1 text-sm">
          <li><Link href="/docs/hosting-deploy" className="underline">Releasing and deploying</Link></li>
          <li><Link href="/docs/hosting-maintenance" className="underline">Server maintenance and rotation</Link></li>
          <li><Link href="/docs" className="underline">All docs</Link></li>
        </ul>
      </Section>
    </div>
  );
}
