import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { requireActiveUser } from '@/lib/session';
import type { Collection, OwnerRow, WantItem } from '@/lib/types';
import CollectionChips from '@/ui/CollectionChips';
import FormError from '@/ui/FormError';
import WantList from '@/ui/WantList';
import { deleteWant, updateWant } from './actions';

export const dynamic = 'force-dynamic';

const MESSAGES = {
  'invalid': 'Pick must-have or nice-to-have for the priority.',
  'not-found': 'That want is already gone.',
  'forbidden': 'You can’t change wants in that collection.',
};

/**
 * The want list (#8): what to look for in a record store, and whether anyone
 * in the family already has it (#13). One page across every collection you
 * can see, narrowed by `?collectionId=` so the filtered view is a link.
 */
export default async function WantsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireActiveUser();
  const [collections, owners, params] = await Promise.all([
    apiGet<Collection[]>('/collection'),
    apiGet<OwnerRow[]>('/owner'),
    searchParams,
  ]);
  // Only a collection the caller can see narrows the list; anything else shows all.
  const current = collections.find((c) => c.id === params.collectionId);
  const query = new URLSearchParams({ includeMatches: 'true', ...(current ? { collectionId: current.id } : {}) });
  const wants = await apiGet<WantItem[]>(`/want?${query}`);
  const names = new Map(collections.map((c) => [c.id, c.name]));
  // Where Edit/Delete come back to: this same view, filter included.
  const here = current ? `/wants?collectionId=${encodeURIComponent(current.id)}` : '/wants';
  const addHref = current ? `/wants/new?collectionId=${encodeURIComponent(current.id)}` : '/wants/new';

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="font-display text-lg font-semibold">Want list</h1>
        <Link href={addHref} className="text-sm text-primary underline">Add a want</Link>
      </div>
      <FormError code={typeof params.error === 'string' ? params.error : undefined} messages={MESSAGES} />
      {collections.length > 1 && (
        <CollectionChips
          collections={collections}
          currentId={current?.id}
          hrefFor={(id) => (id ? `/wants?collectionId=${encodeURIComponent(id)}` : '/wants')}
          all
        />
      )}
      <WantList
        wants={wants}
        collectionNames={names}
        showCollection={!current && collections.length > 1}
        back={here}
        myOwnerId={owners.find((o) => o.userId === me.id)?.id}
        actions={{ update: updateWant, remove: deleteWant }}
      />
    </section>
  );
}
