'use client';

import { useRouter } from 'next/navigation';
import type { Collection } from '@/lib/types';

/**
 * Picks which collection you're browsing (#14). Only shows collections the
 * caller owns or has been shared — the API already scopes the list, so there
 * is nothing to filter here.
 */
export default function CollectionSwitcher({
  collections,
  currentId,
}: {
  collections: Collection[];
  currentId: string;
}) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      <select
        aria-label="Collection"
        value={currentId}
        onChange={(e) => router.push(`/collection/${e.target.value}`)}
        className="w-full rounded-md border border-black/15 bg-transparent px-2 py-1.5 text-base font-medium dark:border-white/20"
      >
        {collections.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} ({c.albumCount})
          </option>
        ))}
      </select>
    </div>
  );
}
