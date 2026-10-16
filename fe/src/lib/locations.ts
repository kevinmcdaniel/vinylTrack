import type { Location } from './types';

/**
 * Where a location may sit (#102): any location in its collection except
 * itself and anything already inside it, or the parent chain would loop.
 * The BE doesn't check either, so the picker is what keeps the tree sane.
 */
export function parentChoices(locations: Location[], selfId?: string): Location[] {
  const excluded = new Set<string>();
  if (selfId) {
    excluded.add(selfId);
    // Parent/child stays shallow (Room → Shelf), so a few passes settle it.
    let grew = true;
    while (grew) {
      grew = false;
      for (const l of locations) {
        if (l.parentLocationId && excluded.has(l.parentLocationId) && !excluded.has(l.id)) {
          excluded.add(l.id);
          grew = true;
        }
      }
    }
  }
  return locations.filter((l) => !excluded.has(l.id)).sort((a, b) => a.name.localeCompare(b.name));
}
