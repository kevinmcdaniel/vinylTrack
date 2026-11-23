import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiGet, ApiError } from '@/lib/api';
import { requireActiveUser } from '@/lib/session';
import type { Collection } from '@/lib/types';
import CollectionSettings from '@/ui/CollectionSettings';
import { renameCollection, shareCollection, unshareCollection } from './actions';

export const dynamic = 'force-dynamic';

type Person = { id: string; name: string | null; email: string };
type Props = {
  params: Promise<{ collectionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);

/**
 * A collection's settings (#125): rename and sharing. Owner or admin only; a
 * member it's shared with gets the same 404 as anyone else, so the page
 * gives away nothing (the BE refuses them too).
 */
export default async function SettingsPage({ params, searchParams }: Props) {
  const [{ collectionId }, query, me] = await Promise.all([params, searchParams, requireActiveUser()]);
  let collection: Collection;
  try {
    collection = await apiGet<Collection>(`/collection/${encodeURIComponent(collectionId)}`);
  } catch (e) {
    if (e instanceof ApiError && e.notFound) notFound();
    throw e;
  }
  if (!me.isAdmin && collection.ownerId !== me.id) notFound();

  const base = `/collection/${encodeURIComponent(collection.id)}/share`;
  const [shares, candidates] = await Promise.all([apiGet<Person[]>(base), apiGet<Person[]>(`${base}/candidates`)]);
  return (
    <section className="flex flex-col gap-4">
      <div>
        <Link href={`/collection/${encodeURIComponent(collection.id)}`} className="text-sm text-primary underline">← {collection.name}</Link>
        <h1 className="mt-2 font-display text-lg font-semibold">{collection.name} settings</h1>
      </div>
      <CollectionSettings
        collection={collection}
        shares={shares}
        candidates={candidates}
        error={one(query.error)}
        saved={one(query.saved)}
        actions={{ rename: renameCollection, share: shareCollection, unshare: unshareCollection }}
      />
    </section>
  );
}
