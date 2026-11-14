import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiGet, ApiError } from '@/lib/api';
import { fullPath } from '@/lib/locations';
import type { Location } from '@/lib/types';
import FormError from '@/ui/FormError';
import LocationFields, { LOCATION_MESSAGES, locationPrimaryButton } from '@/ui/LocationFields';
import { deleteLocation, updateLocation } from '../../../collection/[collectionId]/locations/actions';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Edit a location's name, kind and parent, or delete it (#102, #137). Delete
 * sits in a closed <details>, a deliberate second tap away (PR #110 review).
 * 404 when it isn't yours to see, as on its contents page.
 */
export default async function EditLocationPage({ params, searchParams }: Props) {
  const [{ locationId }, { error }] = await Promise.all([params, searchParams]);
  let location: Location;
  try {
    location = await apiGet<Location>(`/location/${encodeURIComponent(locationId)}`);
  } catch (e) {
    if (e instanceof ApiError && e.notFound) notFound();
    throw e;
  }
  const locations = await apiGet<Location[]>('/location', { collectionId: location.collectionId });
  const byId = new Map(locations.map((l) => [l.id, l]));
  const path = fullPath(location, byId);
  const hidden = (
    <>
      <input type="hidden" name="collectionId" value={location.collectionId} />
      <input type="hidden" name="id" value={location.id} />
    </>
  );
  return (
    <section className="flex flex-col gap-4">
      <div>
        <Link href={`/collection/${encodeURIComponent(location.collectionId)}/locations`} className="text-sm text-primary underline">← Locations</Link>
        <h1 className="mt-2 font-display text-lg font-semibold">Edit {path}</h1>
      </div>
      <FormError code={typeof error === 'string' ? error : undefined} messages={LOCATION_MESSAGES} />
      <form action={updateLocation} className="flex flex-col gap-3">
        {hidden}
        <LocationFields location={location} locations={locations} byId={byId} defaultKind={location.kind} />
        <button type="submit" className={`${locationPrimaryButton} self-start`}>Save</button>
      </form>
      <details>
        <summary className="cursor-pointer text-sm text-primary underline">Delete…</summary>
        <form action={deleteLocation} className="mt-2">
          {hidden}
          <button type="submit" className="text-sm text-primary underline" aria-label={`Delete ${path}`}>Delete</button>
        </form>
      </details>
    </section>
  );
}
