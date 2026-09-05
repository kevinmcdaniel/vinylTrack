import { notFound } from 'next/navigation';
import { apiGet, ApiError } from '@/lib/api';
import { distinctArtists, distinctValues } from '@/lib/filters';
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

const one = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

export default async function CollectionPage({ params, searchParams }: Props) {
  const { collectionId } = await params;
  const search = await searchParams;

  const collections = await apiGet<Collection[]>('/collection');
  const current = collections.find((c) => c.id === collectionId);
  if (!current) notFound();

  const filters = {
    collectionId,
    q: one(search.q),
    artistId: one(search.artistId),
    format: one(search.format),
    genre: one(search.genre),
  };

  let albums: Album[] = [];
  try {
    albums = await apiGet<Album[]>('/album', filters);
  } catch (error) {
    if (error instanceof ApiError && error.notFound) notFound();
    throw error;
  }

  // Filter options come from the collection as a whole, not the filtered
  // result — otherwise picking one genre would erase every other choice.
  const all = filters.q || filters.artistId || filters.format || filters.genre
    ? await apiGet<Album[]>('/album', { collectionId })
    : albums;

  return (
    <div className="flex flex-col gap-4">
      <CollectionSwitcher collections={collections} currentId={collectionId} />

      <FilterBar
        options={{
          artists: distinctArtists(all),
          formats: distinctValues(all, 'format'),
          genres: distinctValues(all, 'genre'),
        }}
      />

      <p className="text-xs uppercase tracking-wide opacity-55">
        {albums.length} {albums.length === 1 ? 'release' : 'releases'}
      </p>

      {albums.length === 0 ? (
        <EmptyState>Nothing in {current.name} matches those filters.</EmptyState>
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
