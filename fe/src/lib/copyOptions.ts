import { fullPath } from './locations';
import type { Location, OwnerRow } from './types';

/** Picker options for a copy form (#102): locations by full path, owners by name. */
export const locationOptions = (locations: Location[]) => {
  const byId = new Map(locations.map((l) => [l.id, l]));
  return locations.map((l) => ({ id: l.id, label: fullPath(l, byId) })).sort((a, b) => a.label.localeCompare(b.label));
};

export const ownerOptions = (owners: OwnerRow[]) =>
  owners.map((o) => ({ id: o.id, label: o.name })).sort((a, b) => a.label.localeCompare(b.label));
