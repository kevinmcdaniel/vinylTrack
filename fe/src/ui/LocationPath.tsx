import Link from 'next/link';
import { locationPath } from '@/lib/filters';
import type { Location } from '@/lib/types';

/**
 * "Basement → Shelf 3" — where you actually walk to find the record. Links to
 * everything else in that location (#126).
 */
export default function LocationPath({ location }: { location: Location }) {
  return (
    <Link href={`/location/${encodeURIComponent(location.id)}`} className="font-medium underline decoration-border underline-offset-2">
      {locationPath(location)}
    </Link>
  );
}
