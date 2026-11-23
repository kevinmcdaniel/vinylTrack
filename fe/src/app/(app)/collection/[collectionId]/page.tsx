import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiGet, ApiError } from '@/lib/api';
import { distinctArtists, distinctValues } from '@/lib/filters';
import { albumFiltersFrom, filterOptionSource, hasActiveFilters } from '@/lib/searchParams';
import { requireActiveUser } from '@/lib/session';
import AlbumCard from '@/ui/AlbumCard';
import CollectionSwitcher from '@/ui/CollectionSwitcher';
import EmptyState from '@/ui/EmptyState';
import FilterBar from '@/ui/FilterBar';
import type { Album, Collection } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ collectionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CollectionPage({ params, searchParams }: Props) {
  const { collectionId } = await params;
  const search = await searchParams;

  const [collections, me] = await Promise.all([apiGet<Collection[]>('/collection'), requireActiveUser()]);
  const current = collections.find((c) => c.id === collectionId);
  if (!current) notFound();
  // Rename and sharing are the owner's (or an admin's), #125.
  const canManage = me.isAdmin || current.ownerId === me.id;

  const filters = albumFiltersFrom(collectionId, search);

  let albums: Album[] = [];
  try {
    albums = await apiGet<Album[]>('/album', filters);
  } catch (error) {
    if (error instanceof ApiError && error.notFound) notFound();
    throw error;
  }

  const filtered = hasActiveFilters(filters);
  const all = await filterOptionSource(filters, albums, () =>
    apiGet<Album[]>('/album', { collectionId }),
  );

  return (
    <div className="flex flex-col gap-4">
      <CollectionSwitcher collections={collections} currentId={collectionId} />
      {current.ownerId !== me.id && (
        <p className="-mt-2 text-sm text-text-muted">
          {me.isAdmin ? 'Owned by' : 'Shared by'} {current.owner?.name ?? 'its owner'}
        </p>
      )}

      <FilterBar
        options={{
          artists: distinctArtists(all),
          formats: distinctValues(all, 'format'),
          genres: distinctValues(all, 'genre'),
        }}
      />

      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs uppercase tracking-wide opacity-55">
          {albums.length} {albums.length === 1 ? 'release' : 'releases'}
        </p>
        <div className="flex gap-3">
          <Link href={`/collection/${encodeURIComponent(collectionId)}/copy/new`} className="text-sm text-primary underline">Add copy</Link>
          <Link href={`/collection/${encodeURIComponent(collectionId)}/locations`} className="text-sm text-primary underline">Locations</Link>
          {canManage && (
            <Link href={`/collection/${encodeURIComponent(collectionId)}/settings`} className="text-sm text-primary underline">Settings</Link>
          )}
        </div>
      </div>

      {albums.length === 0 ? (
        <EmptyState>
          {filtered
            ? `Nothing in ${current.name} matches those filters.`
            : `Nothing in ${current.name} yet.`}
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {albums.map((album) => (
            <li key={album.id}>
              <AlbumCard album={album} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
