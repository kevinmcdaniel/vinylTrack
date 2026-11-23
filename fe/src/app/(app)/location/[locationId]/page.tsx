import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiGet, ApiError } from '@/lib/api';
import { fullPath } from '@/lib/locations';
import type { Location, LocationCopy } from '@/lib/types';
import LocationContents from '@/ui/LocationContents';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locationId: string }> };

/** What's in a location, its boxes included (#126). 404 when it isn't yours to see. */
export default async function LocationPage({ params }: Props) {
  const { locationId } = await params;
  let location: Location;
  try {
    location = await apiGet<Location>(`/location/${encodeURIComponent(locationId)}`);
  } catch (e) {
    if (e instanceof ApiError && e.notFound) notFound();
    throw e;
  }
  const [locations, copies] = await Promise.all([
    apiGet<Location[]>('/location', { collectionId: location.collectionId }),
    apiGet<LocationCopy[]>('/copy', { locationId: location.id, includeSublocations: 'true' }),
  ]);
  const byId = new Map(locations.map((l) => [l.id, l]));
  return (
    <section className="flex flex-col gap-4">
      <div>
        <Link href={`/collection/${encodeURIComponent(location.collectionId)}/locations`} className="text-sm text-primary underline">← Locations</Link>
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <h1 className="min-w-0 font-display text-lg font-semibold">{fullPath(location, byId)}</h1>
          <Link href={`/location/${encodeURIComponent(location.id)}/edit`} className="shrink-0 text-sm text-primary underline">Edit</Link>
        </div>
      </div>
      <LocationContents location={location} locations={locations} copies={copies} />
    </section>
  );
}
