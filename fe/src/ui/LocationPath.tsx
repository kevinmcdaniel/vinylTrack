import { locationPath } from '@/lib/filters';
import type { Location } from '@/lib/types';

/** "Basement → Shelf 3" — where you actually walk to find the record. */
export default function LocationPath({ location }: { location: Location }) {
  return <span className="font-medium">{locationPath(location)}</span>;
}
