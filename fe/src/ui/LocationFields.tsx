import { fullPath, parentChoices } from '@/lib/locations';
import type { Location } from '@/lib/types';

export const LOCATION_MESSAGES = {
  'invalid': 'Give the location a name and a kind.',
  'in-use': 'That location still has copies or locations inside it. Move them first.',
  'forbidden': 'You can’t change locations in this collection.',
  'not-found': 'That location no longer exists.',
};

export const locationInput = 'min-w-0 rounded-md border border-border bg-surface px-2 py-1 text-sm text-text';
export const locationPrimaryButton = 'rounded-md bg-primary px-3 py-1 text-sm font-medium text-primary-text';

/** Name, kind and parent: the add form on the list and the edit page (#137) share these. */
export default function LocationFields({ location, locations, byId, defaultKind }: {
  location?: Location;
  locations: Location[];
  byId: Map<string, Location>;
  defaultKind: string;
}) {
  const suffix = location?.id ?? 'new';
  const kind = location?.kind ?? defaultKind;
  return (
    <>
      <label className="flex flex-col gap-1 text-sm text-text" htmlFor={`name-${suffix}`}>
        Name
        <input id={`name-${suffix}`} name="name" required defaultValue={location?.name} placeholder="e.g. Basement" className={locationInput} />
      </label>
      <div className="flex gap-2">
        <label className="flex flex-1 flex-col gap-1 text-sm text-text" htmlFor={`kind-${suffix}`}>
          Kind
          <select id={`kind-${suffix}`} name="kind" defaultValue={kind} className={locationInput}>
            <option value="physical">Physical</option>
            <option value="digital">Digital</option>
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm text-text" htmlFor={`parent-${suffix}`}>
          Inside
          <select id={`parent-${suffix}`} name="parentLocationId" defaultValue={location?.parentLocationId ?? ''} className={locationInput}>
            <option value="">Nothing (top level)</option>
            {parentChoices(locations, location?.id)
              .map((l) => ({ id: l.id, path: fullPath(l, byId) }))
              .sort((a, b) => a.path.localeCompare(b.path))
              .map((l) => <option key={l.id} value={l.id}>{l.path}</option>)}
          </select>
        </label>
      </div>
    </>
  );
}
