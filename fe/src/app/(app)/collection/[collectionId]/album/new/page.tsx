import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiGet, ApiError } from '@/lib/api';
import type { Artist, Collection } from '@/lib/types';
import AlbumForm from '@/ui/AlbumForm';
import { createAlbum, createArtist } from '../../../../album/actions';

export const dynamic = 'force-dynamic';

const MESSAGES = {
  'invalid': 'Give the album a title.',
  'in-use': 'One of those artists no longer exists. Pick again.',
  'forbidden': 'You can’t add albums to this collection.',
};

type Props = {
  params: Promise<{ collectionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Add an album to one collection (#102). */
export default async function NewAlbumPage({ params, searchParams }: Props) {
  const [{ collectionId }, { error }] = await Promise.all([params, searchParams]);
  let collection: Collection;
  let artists: Artist[];
  try {
    [collection, artists] = await Promise.all([
      apiGet<Collection>(`/collection/${encodeURIComponent(collectionId)}`),
      apiGet<Artist[]>('/artist'),
    ]);
  } catch (e) {
    if (e instanceof ApiError && e.notFound) notFound();
    throw e;
  }
  return (
    <section className="flex flex-col gap-4">
      <div>
        <Link href={`/collection/${encodeURIComponent(collection.id)}`} className="text-sm text-primary underline">← {collection.name}</Link>
        <h1 className="mt-2 font-display text-lg font-semibold">New album in {collection.name}</h1>
      </div>
      <AlbumForm
        collectionId={collection.id}
        artists={artists}
        action={createAlbum}
        createArtist={createArtist}
        submitLabel="Add album"
        error={typeof error === 'string' ? error : undefined}
        messages={MESSAGES}
      />
    </section>
  );
}
