import { locationPath } from '@/lib/filters';
import { parentChoices } from '@/lib/locations';
import type { Collection, Location } from '@/lib/types';
import FormError from './FormError';

type Action = (formData: FormData) => Promise<void>;

const MESSAGES = {
  'invalid': 'Give the location a name and a kind.',
  'in-use': 'That location still has copies or locations inside it. Move them first.',
  'forbidden': 'You can’t change locations in this collection.',
  'not-found': 'That location no longer exists.',
};

const input = 'min-w-0 rounded-md border border-border bg-surface px-2 py-1 text-sm text-text';
const primaryButton = 'rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-text';
const quietButton = 'text-sm text-primary underline';

function Fields({ location, locations, defaultKind }: { location?: Location; locations: Location[]; defaultKind: string }) {
  const suffix = location?.id ?? 'new';
  const kind = location?.kind ?? defaultKind;
  return (
    <>
      <label className="flex flex-col gap-1 text-sm text-text" htmlFor={`name-${suffix}`}>
        Name
        <input id={`name-${suffix}`} name="name" required defaultValue={location?.name} placeholder="e.g. Basement" className={input} />
      </label>
      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1 text-sm text-text" htmlFor={`kind-${suffix}`}>
          Kind
          <select id={`kind-${suffix}`} name="kind" defaultValue={kind} className={input}>
            <option value="physical">Physical</option>
            <option value="digital">Digital</option>
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm text-text" htmlFor={`parent-${suffix}`}>
          Inside
          <select id={`parent-${suffix}`} name="parentLocationId" defaultValue={location?.parentLocationId ?? ''} className={input}>
            <option value="">Nothing (top level)</option>
            {parentChoices(locations, location?.id).map((l) => (
              <option key={l.id} value={l.id}>{locationPath(l)}</option>
            ))}
          </select>
        </label>
      </div>
    </>
  );
}

/**
 * Add, edit and delete one collection's locations (#102). Plain forms posting
 * to Server Actions; each row's edit form sits behind a <details>.
 */
export default function LocationsList({ collection, locations, error, actions }: {
  collection: Pick<Collection, 'id' | 'kind'>;
  locations: Location[];
  error?: string;
  actions: { create: Action; update: Action; remove: Action };
}) {
  const sorted = [...locations].sort((a, b) => locationPath(a).localeCompare(locationPath(b)));
  return (
    <div className="flex flex-col gap-4">
      <FormError code={error} messages={MESSAGES} />

      <details className="rounded-xl border border-border bg-surface px-3 py-2" open={locations.length === 0}>
        <summary className={`${quietButton} cursor-pointer`}>Add location</summary>
        <form action={actions.create} className="mt-2 flex flex-col gap-3">
          <input type="hidden" name="collectionId" value={collection.id} />
          <Fields locations={locations} defaultKind={collection.kind === 'digital' ? 'digital' : 'physical'} />
          <button type="submit" className={`${primaryButton} self-start`}>Add location</button>
        </form>
      </details>

      {sorted.length === 0 ? (
        <p className="text-sm text-text-muted">No locations yet. Add the first one above.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
          {sorted.map((location) => {
            const path = locationPath(location);
            return (
              <li key={location.id} className="flex flex-col gap-2 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-text">{path}</span>
                  <span className="text-xs text-text-muted">{location.kind}</span>
                </div>
                <div className="flex items-start gap-4">
                  <details className="flex-1">
                    <summary className={`${quietButton} cursor-pointer`}>Edit</summary>
                    <form action={actions.update} className="mt-2 flex flex-col gap-3">
                      <input type="hidden" name="collectionId" value={collection.id} />
                      <input type="hidden" name="id" value={location.id} />
                      <Fields location={location} locations={locations} defaultKind={location.kind} />
                      <button type="submit" className={`${primaryButton} self-start`}>Save</button>
                    </form>
                  </details>
                  <form action={actions.remove}>
                    <input type="hidden" name="collectionId" value={collection.id} />
                    <input type="hidden" name="id" value={location.id} />
                    <button type="submit" className={quietButton} aria-label={`Delete ${path}`}>Delete</button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
