import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiGet, ApiError } from '@/lib/api';
import type { Collection, Location } from '@/lib/types';
import LocationsList from '@/ui/LocationsList';
import { createLocation, deleteLocation, updateLocation } from './actions';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ collectionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Where this collection's copies can live (#102). One collection's shelves only. */
export default async function LocationsPage({ params, searchParams }: Props) {
  const [{ collectionId }, { error }] = await Promise.all([params, searchParams]);

  let collection: Collection;
  let locations: Location[];
  try {
    [collection, locations] = await Promise.all([
      apiGet<Collection>(`/collection/${encodeURIComponent(collectionId)}`),
      apiGet<Location[]>('/location', { collectionId }),
    ]);
  } catch (e) {
    if (e instanceof ApiError && e.notFound) notFound();
    throw e;
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <Link href={`/collection/${collection.id}`} className="text-sm text-primary underline">← {collection.name}</Link>
        <h1 className="mt-2 font-display text-lg font-semibold">Locations</h1>
        <p className="text-sm text-text-muted">Where {collection.name} copies live: a room, a shelf inside it, a drive.</p>
      </div>
      <LocationsList
        collection={collection}
        locations={locations}
        error={typeof error === 'string' ? error : undefined}
        actions={{ create: createLocation, update: updateLocation, remove: deleteLocation }}
      />
    </section>
  );
}
