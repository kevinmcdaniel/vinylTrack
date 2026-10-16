import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiGet, ApiError } from '@/lib/api';
import { locationOptions, ownerOptions } from '@/lib/copyOptions';
import { showsPhysicalDetail } from '@/lib/filters';
import type { AlbumDetail, Copy, Location, OwnerRow } from '@/lib/types';
import CopyForm from '@/ui/CopyForm';
import { createLocationInline, createOwnerInline, deleteCopy, updateCopy } from '../../actions';

export const dynamic = 'force-dynamic';

const MESSAGES = {
  'invalid': 'Pick a location and an owner, both from this collection.',
  'in-use': 'That location or owner no longer exists. Pick again.',
  'not-found': 'That copy no longer exists.',
};

type Props = {
  params: Promise<{ copyId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Move, re-attribute or delete a copy (#102). Delete sits behind its own disclosure. */
export default async function EditCopyPage({ params, searchParams }: Props) {
  const [{ copyId }, { error }] = await Promise.all([params, searchParams]);
  let copy: Copy;
  let album: AlbumDetail;
  try {
    copy = await apiGet<Copy>(`/copy/${encodeURIComponent(copyId)}`);
    album = await apiGet<AlbumDetail>(`/album/${encodeURIComponent(copy.albumId)}`);
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
        <h1 className="mt-2 font-display text-lg font-semibold">Edit copy</h1>
      </div>
      <CopyForm
        copy={copy}
        albumId={album.id}
        physical={showsPhysicalDetail(album.collection.kind)}
        locations={locationOptions(locations)}
        owners={ownerOptions(owners)}
        action={updateCopy}
        createLocation={createLocationInline.bind(null, album.collectionId, kind)}
        createOwner={createOwnerInline}
        submitLabel="Save"
        error={typeof error === 'string' ? error : undefined}
        messages={MESSAGES}
      />
      <details className="rounded-xl border border-border bg-surface px-3 py-2">
        <summary className="cursor-pointer text-sm text-primary underline">Delete copy</summary>
        <form action={deleteCopy} className="mt-2 flex flex-col gap-2">
          <input type="hidden" name="id" value={copy.id} />
          <input type="hidden" name="albumId" value={album.id} />
          <p className="text-sm text-text-muted">This copy&rsquo;s record goes for good. The album stays.</p>
          <button type="submit" className="self-start rounded-md bg-danger-bg px-3 py-1 text-sm font-medium text-danger-text">Delete this copy</button>
        </form>
      </details>
    </section>
  );
}
