import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiGet, ApiError } from '@/lib/api';
import { locationOptions, ownerOptions } from '@/lib/copyOptions';
import { showsPhysicalDetail } from '@/lib/filters';
import { requireActiveUser } from '@/lib/session';
import type { Artist, Collection, Location, OwnerRow } from '@/lib/types';
import AlbumChoice from '@/ui/AlbumChoice';
import CopyForm from '@/ui/CopyForm';
import { createArtist } from '../../../../album/actions';
import { addCopy, createLocationInline, createOwnerInline, findAlbumMatches, searchAlbums } from '../../../../copy/actions';

export const dynamic = 'force-dynamic';

const MESSAGES = {
  'pick-album': 'Pick an album, or switch to New album.',
  'title': 'Give the new album a title.',
  'invalid': 'Check the details: a location and owner from this collection, a year like 1972, a price like 12.50.',
  'in-use': 'That location, owner or artist no longer exists. Pick again.',
  'forbidden': 'You can’t add copies to this collection.',
};

type Props = {
  params: Promise<{ collectionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);

/**
 * Add a copy to a collection (#123), with an album already there or a new
 * one created with it. An album with no copy is a want, made from the want
 * list, so this page never makes an album on its own.
 */
export default async function AddCopyPage({ params, searchParams }: Props) {
  const [{ collectionId }, query, me] = await Promise.all([params, searchParams, requireActiveUser()]);
  const q = one(query.q)?.trim() ?? '';
  let collection: Collection;
  try {
    collection = await apiGet<Collection>(`/collection/${encodeURIComponent(collectionId)}`);
  } catch (e) {
    if (e instanceof ApiError && e.notFound) notFound();
    throw e;
  }
  const [locations, owners, artists, results] = await Promise.all([
    apiGet<Location[]>('/location', { collectionId: collection.id }),
    apiGet<OwnerRow[]>('/owner'),
    apiGet<Artist[]>('/artist'),
    q ? searchAlbums(collection.id, q) : Promise.resolve([]),
  ]);
  const kind = collection.kind === 'digital' ? 'digital' : 'physical';
  return (
    <section className="flex flex-col gap-4">
      <div>
        <Link href={`/collection/${encodeURIComponent(collection.id)}`} className="text-sm text-primary underline">← {collection.name}</Link>
        <h1 className="mt-2 font-display text-lg font-semibold">Add a copy to {collection.name}</h1>
      </div>
      {/* The album search without JS: its fields sit inside the form below, tied here by form="album-search". */}
      <form id="album-search" method="get" />
      <CopyForm
        hidden={{ collectionId: collection.id }}
        physical={showsPhysicalDetail(collection.kind)}
        locations={locationOptions(locations)}
        owners={ownerOptions(owners)}
        defaultOwnerId={owners.find((o) => o.userId === me.id)?.id}
        action={addCopy}
        createLocation={createLocationInline.bind(null, collection.id, kind)}
        createOwner={createOwnerInline}
        submitLabel="Add copy"
        error={one(query.error)}
        messages={MESSAGES}
      >
        <AlbumChoice
          collectionName={collection.name}
          mode={one(query.mode) === 'new' ? 'new' : 'existing'}
          query={q}
          results={results}
          artists={artists}
          createArtist={createArtist}
          searchAlbums={searchAlbums.bind(null, collection.id)}
          findMatches={findAlbumMatches.bind(null, collection.id)}
        />
      </CopyForm>
    </section>
  );
}
