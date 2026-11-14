import Link from 'next/link';
import { fullPath } from '@/lib/locations';
import type { Collection, Location } from '@/lib/types';
import FormError from './FormError';
import ListRow from './ListRow';
import LocationFields, { LOCATION_MESSAGES, locationPrimaryButton } from './LocationFields';
import RowFilter from './RowFilter';

type Action = (formData: FormData) => Promise<void>;

/**
 * Add a location, and one line per location (#102, #137): the path opens
 * what's in it (#126), **Edit** opens `/location/[id]/edit`. The kind shows
 * only when it differs from the collection's, since it nearly never does.
 */
export default function LocationsList({ collection, locations, error, actions }: {
  collection: Pick<Collection, 'id' | 'kind'>;
  locations: Location[];
  error?: string;
  actions: { create: Action };
}) {
  const byId = new Map(locations.map((l) => [l.id, l]));
  const collectionKind = collection.kind === 'digital' ? 'digital' : 'physical';
  const rows = locations
    .map((location) => ({ location, path: fullPath(location, byId) }))
    .sort((a, b) => a.path.localeCompare(b.path));
  return (
    <div className="flex flex-col gap-4">
      <FormError code={error} messages={LOCATION_MESSAGES} />

      <details className="rounded-xl border border-border bg-surface px-3 py-2" open={locations.length === 0}>
        <summary className="cursor-pointer text-sm text-primary underline">Add location</summary>
        <form action={actions.create} className="mt-2 flex flex-col gap-3">
          <input type="hidden" name="collectionId" value={collection.id} />
          <LocationFields locations={locations} byId={byId} defaultKind={collectionKind} />
          <button type="submit" className={`${locationPrimaryButton} self-start`}>Add location</button>
        </form>
      </details>

      {rows.length === 0 ? (
        <p className="text-sm text-text-muted">No locations yet. Add the first one above.</p>
      ) : (
        <RowFilter label="Filter locations" count={rows.length}>
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
            {rows.map(({ location, path }) => (
              <ListRow
                key={location.id}
                filterText={path}
                meta={location.kind !== collectionKind ? location.kind : undefined}
                action={<Link href={`/location/${encodeURIComponent(location.id)}/edit`} className="text-primary underline" aria-label={`Edit ${path}`}>Edit</Link>}
              >
                <Link href={`/location/${encodeURIComponent(location.id)}`} className="underline decoration-border underline-offset-2">{path}</Link>
              </ListRow>
            ))}
          </ul>
        </RowFilter>
      )}
    </div>
  );
}
