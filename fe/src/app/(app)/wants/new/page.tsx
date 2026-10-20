import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { requireActiveUser } from '@/lib/session';
import type { Album, Artist, Collection } from '@/lib/types';
import CollectionChips from '@/ui/CollectionChips';
import WantForm from '@/ui/WantForm';
import { createArtist } from '../../album/actions';
import { createWant } from '../actions';

export const dynamic = 'force-dynamic';

const MESSAGES = {
  'invalid': 'Pick an album or an artist, or name a new one.',
  'forbidden': 'You can’t add to that collection.',
  'in-use': 'One of those artists no longer exists. Pick again.',
  'not-found': 'That album or artist no longer exists. Pick again.',
  'both': 'Pick one from the list or type a new name, not both.',
};

/**
 * Add a want (#8). The collection is picked by link, since the album list
 * belongs to it; `?albumId=` preselects one (an album page's "Add to want list"), and
 * `?artistId=` an artist, on the artist half (a retry after a refused want).
 */
export default async function NewWantPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireActiveUser();
  const [collections, params] = await Promise.all([apiGet<Collection[]>('/collection'), searchParams]);
  const current = collections.find((c) => c.id === params.collectionId) ?? collections[0];
  const back = <Link href="/wants" className="text-sm text-primary underline">← Want list</Link>;

  if (!current) {
    return (
      <section className="flex flex-col gap-4">
        {back}
        <p className="text-sm text-text-muted">
          A want belongs to a collection. <Link href="/collection/new" className="text-primary underline">Create one</Link> first.
        </p>
      </section>
    );
  }

  const [albums, artists] = await Promise.all([
    apiGet<Album[]>(`/album?collectionId=${encodeURIComponent(current.id)}`),
    apiGet<Artist[]>('/artist'),
  ]);
  return (
    <section className="flex flex-col gap-4">
      <div>
        {back}
        <h1 className="mt-2 font-display text-lg font-semibold">Add to the want list</h1>
      </div>
      {collections.length > 1 && (
        <CollectionChips
          collections={collections}
          currentId={current.id}
          hrefFor={(id) => `/wants/new?collectionId=${encodeURIComponent(id!)}`}
        />
      )}
      <WantForm
        key={current.id}
        collectionId={current.id}
        albums={albums}
        artists={artists}
        albumId={typeof params.albumId === 'string' ? params.albumId : undefined}
        artistId={typeof params.artistId === 'string' ? params.artistId : undefined}
        action={createWant}
        createArtist={createArtist}
        error={typeof params.error === 'string' ? params.error : undefined}
        messages={MESSAGES}
      />
    </section>
  );
}
