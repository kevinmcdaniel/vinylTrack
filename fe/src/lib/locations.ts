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
    // Repeat until nothing new joins: each pass adds one more level down.
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

/**
 * "Basement → Shelf 3 → Bin": every level up to the top, from the collection's
 * own list (the BE only sends one parent level). `seen` stops at a loop already
 * in the data rather than spinning.
 */
export function fullPath(location: Location, byId: Map<string, Location>): string {
  const names = [location.name];
  const seen = new Set([location.id]);
  let parentId = location.parentLocationId;
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) break;
    names.unshift(parent.name);
    parentId = parent.parentLocationId;
  }
  return names.join(' → ');
}
