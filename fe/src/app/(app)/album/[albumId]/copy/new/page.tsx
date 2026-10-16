import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiGet, ApiError } from '@/lib/api';
import { locationOptions, ownerOptions } from '@/lib/copyOptions';
import { showsPhysicalDetail } from '@/lib/filters';
import { requireActiveUser } from '@/lib/session';
import type { AlbumDetail, Location, OwnerRow } from '@/lib/types';
import CopyForm from '@/ui/CopyForm';
import { createCopy, createLocationInline, createOwnerInline } from '../../../../copy/actions';

export const dynamic = 'force-dynamic';

const MESSAGES = {
  'invalid': 'Pick a location and an owner, both from this collection.',
  'in-use': 'That location or owner no longer exists. Pick again.',
  'forbidden': 'You can’t add copies to this collection.',
};

type Props = {
  params: Promise<{ albumId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Record a copy of an album (#102). */
export default async function NewCopyPage({ params, searchParams }: Props) {
  const [{ albumId }, { error }, me] = await Promise.all([params, searchParams, requireActiveUser()]);
  let album: AlbumDetail;
  try {
    album = await apiGet<AlbumDetail>(`/album/${encodeURIComponent(albumId)}`);
  } catch (e) {
    if (e instanceof ApiError && e.notFound) notFound();
    throw e;
  }
  const [locations, owners] = await Promise.all([
    apiGet<Location[]>('/location', { collectionId: album.collectionId }),
    apiGet<OwnerRow[]>('/owner'),
  ]);
  const kind = album.collection.kind === 'digital' ? 'digital' : 'physical';
  return (
    <section className="flex flex-col gap-4">
      <div>
        <Link href={`/album/${encodeURIComponent(album.id)}`} className="text-sm text-primary underline">← {album.title}</Link>
        <h1 className="mt-2 font-display text-lg font-semibold">Add a copy of {album.title}</h1>
      </div>
      <CopyForm
        albumId={album.id}
        physical={showsPhysicalDetail(album.collection.kind)}
        locations={locationOptions(locations)}
        owners={ownerOptions(owners)}
        defaultOwnerId={owners.find((o) => o.userId === me.id)?.id}
        action={createCopy}
        createLocation={createLocationInline.bind(null, album.collectionId, kind)}
        createOwner={createOwnerInline}
        submitLabel="Add copy"
        error={typeof error === 'string' ? error : undefined}
        messages={MESSAGES}
      />
    </section>
  );
}
