import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { requireActiveUser } from '@/lib/session';
import type { Collection, WantItem } from '@/lib/types';
import WantList from '@/ui/WantList';

export const dynamic = 'force-dynamic';

/**
 * The want list (#8): what to look for in a record store, and whether anyone
 * in the family already has it (#13). One page across every collection you
 * can see, narrowed by `?collectionId=` so the filtered view is a link.
 */
export default async function WantsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireActiveUser();
  const [collections, params] = await Promise.all([apiGet<Collection[]>('/collection'), searchParams]);
  // Only a collection the caller can see narrows the list; anything else shows all.
  const current = collections.find((c) => c.id === params.collectionId);
  const query = new URLSearchParams({ includeMatches: 'true', ...(current ? { collectionId: current.id } : {}) });
  const wants = await apiGet<WantItem[]>(`/want?${query}`);
  const names = new Map(collections.map((c) => [c.id, c.name]));

  return (
    <section className="flex flex-col gap-4">
      <h1 className="font-display text-lg font-semibold">Want list</h1>
      {collections.length > 1 && (
        <nav aria-label="Collections" className="flex flex-wrap gap-2 text-sm">
          <Chip href="/wants" active={!current}>All</Chip>
          {collections.map((c) => (
            <Chip key={c.id} href={`/wants?collectionId=${encodeURIComponent(c.id)}`} active={current?.id === c.id}>
              {c.name}
            </Chip>
          ))}
        </nav>
      )}
      <WantList wants={wants} collectionNames={names} showCollection={!current && collections.length > 1} />
    </section>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`rounded-full border px-3 py-1 ${active ? 'border-primary-border bg-primary-bg text-primary' : 'border-border bg-surface text-text-secondary'}`}
    >
      {children}
    </Link>
  );
}
