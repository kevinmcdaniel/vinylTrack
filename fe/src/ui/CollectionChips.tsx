import Link from 'next/link';
import type { Collection } from '@/lib/types';

/**
 * Pick a collection with plain links (#8), so the choice lives in the URL and
 * works before JS loads. `hrefFor(undefined)` is the "All" chip, when offered.
 */
export default function CollectionChips({ collections, currentId, hrefFor, all = false }: {
  collections: Pick<Collection, 'id' | 'name'>[];
  currentId: string | undefined;
  hrefFor: (collectionId: string | undefined) => string;
  all?: boolean;
}) {
  return (
    <nav aria-label="Collections" className="flex flex-wrap gap-2 text-sm">
      {all && <Chip href={hrefFor(undefined)} active={!currentId}>All</Chip>}
      {collections.map((c) => (
        <Chip key={c.id} href={hrefFor(c.id)} active={currentId === c.id}>{c.name}</Chip>
      ))}
    </nav>
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
