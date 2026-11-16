import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { requireActiveUser } from '@/lib/session';
import type { Collection } from '@/lib/types';
import EmptyState from '@/ui/EmptyState';
import ListRow from '@/ui/ListRow';
import RowFilter from '@/ui/RowFilter';

export const dynamic = 'force-dynamic';

const albums = (n: number) => `${n} ${n === 1 ? 'album' : 'albums'}`;

/**
 * Every collection you can see, one line each (#140, #137 rows): the name
 * opens it, then its album count, then **Settings** for its owner or an admin.
 * Someone else's says whose it is instead.
 */
export default async function CollectionsPage() {
  const [me, collections] = await Promise.all([requireActiveUser(), apiGet<Collection[]>('/collection')]);
  const sorted = [...collections].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="font-display text-lg font-semibold">Collections</h1>
        <Link href="/collection/new" className="text-sm text-primary underline">+ New</Link>
      </div>
      {sorted.length === 0 ? (
        <EmptyState>
          No collections yet. <Link href="/collection/new" className="text-primary underline">New collection</Link>
        </EmptyState>
      ) : (
        <RowFilter label="Filter collections" count={sorted.length}>
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
            {sorted.map((c) => {
              const mine = c.ownerId === me.id;
              const whose = mine ? undefined : `${me.isAdmin ? 'Owned by' : 'Shared by'} ${c.owner?.name ?? 'its owner'}`;
              return (
                <ListRow
                  key={c.id}
                  filterText={c.name}
                  meta={whose ? `${albums(c.albumCount)} · ${whose}` : albums(c.albumCount)}
                  action={(mine || me.isAdmin) ? (
                    <Link href={`/collection/${encodeURIComponent(c.id)}/settings`} className="text-primary underline" aria-label={`Settings for ${c.name}`}>Settings</Link>
                  ) : undefined}
                >
                  <Link href={`/collection/${encodeURIComponent(c.id)}`} className="underline decoration-border underline-offset-2">{c.name}</Link>
                </ListRow>
              );
            })}
          </ul>
        </RowFilter>
      )}
    </section>
  );
}
