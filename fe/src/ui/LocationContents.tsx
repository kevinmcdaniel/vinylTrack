import Link from 'next/link';
import { fullPath } from '@/lib/locations';
import type { Location, LocationCopy } from '@/lib/types';

const plural = (n: number) => `${n} ${n === 1 ? 'copy' : 'copies'}`;

/**
 * What's in a location (#126): its copies and those in every location inside
 * it, as the BE orders them (shallowest first, then by album). A copy deeper
 * down names its sub-location relative to this one, so a shelf shows which
 * box. Copies, not albums: two of the same album on one shelf are two things
 * to find, each with its own owner.
 */
export default function LocationContents({ location, locations, copies }: {
  location: Location;
  locations: Location[];
  copies: LocationCopy[];
}) {
  const byId = new Map(locations.map((l) => [l.id, l]));
  const prefix = `${fullPath(location, byId)} → `;
  const subPath = (copy: LocationCopy) => {
    if (copy.locationId === location.id) return null;
    const where = byId.get(copy.locationId);
    const path = where ? fullPath(where, byId) : copy.location.name;
    return path.startsWith(prefix) ? path.slice(prefix.length) : path;
  };
  const physical = location.kind !== 'digital';

  if (copies.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-text-muted">
        Nothing here yet.{' '}
        <Link href={`/collection/${encodeURIComponent(location.collectionId)}/locations`} className="text-primary underline">All locations</Link>
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs uppercase tracking-wide text-text-muted">{plural(copies.length)}</p>
      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
        {copies.map((copy) => {
          const sub = subPath(copy);
          const meta = [copy.album.artists.map((a) => a.name).join(', '), copy.album.format].filter(Boolean).join(' · ');
          return (
            <li key={copy.id} className="flex flex-col gap-0.5 px-3 py-2">
              <div className="flex items-baseline justify-between gap-3">
                <Link href={`/album/${encodeURIComponent(copy.album.id)}`} className="min-w-0 truncate text-sm font-medium text-text underline decoration-border underline-offset-2">
                  {copy.album.title}
                </Link>
                {sub && <span className="shrink-0 text-xs text-text-muted">{sub}</span>}
              </div>
              {meta && <span className="text-xs text-text-muted">{meta}</span>}
              <span className="text-xs text-text-muted">
                {copy.owner.name}{physical && copy.condition ? ` · ${copy.condition}` : ''}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
