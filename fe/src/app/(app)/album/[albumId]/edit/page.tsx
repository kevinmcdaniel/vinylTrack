import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiGet, ApiError } from '@/lib/api';
import type { AlbumDetail, Artist } from '@/lib/types';
import AlbumForm from '@/ui/AlbumForm';
import { createArtist, deleteAlbum, updateAlbum } from '../../actions';

export const dynamic = 'force-dynamic';

const MESSAGES = {
  'invalid': 'Give the album a title.',
  'in-use': 'This album still has copies or want items. Remove those first.',
  'not-found': 'That album no longer exists.',
};

type Props = {
  params: Promise<{ albumId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Edit or delete an album (#102). Delete sits behind its own disclosure. */
export default async function EditAlbumPage({ params, searchParams }: Props) {
  const [{ albumId }, { error }] = await Promise.all([params, searchParams]);
  let album: AlbumDetail;
  let artists: Artist[];
  try {
    [album, artists] = await Promise.all([
      apiGet<AlbumDetail>(`/album/${encodeURIComponent(albumId)}`),
      apiGet<Artist[]>('/artist'),
    ]);
  } catch (e) {
    if (e instanceof ApiError && e.notFound) notFound();
    throw e;
  }
  return (
    <section className="flex flex-col gap-4">
      <div>
        <Link href={`/album/${encodeURIComponent(album.id)}`} className="text-sm text-primary underline">← {album.title}</Link>
        <h1 className="mt-2 font-display text-lg font-semibold">Edit album</h1>
      </div>
      <AlbumForm
        album={album}
        collectionId={album.collectionId}
        artists={artists}
        action={updateAlbum}
        createArtist={createArtist}
        submitLabel="Save"
        error={typeof error === 'string' ? error : undefined}
        messages={MESSAGES}
      />
      <details className="rounded-xl border border-border bg-surface px-3 py-2">
        <summary className="cursor-pointer text-sm text-primary underline">Delete album</summary>
        <form action={deleteAlbum} className="mt-2 flex flex-col gap-2">
          <input type="hidden" name="id" value={album.id} />
          <input type="hidden" name="collectionId" value={album.collectionId} />
          <p className="text-sm text-text-muted">Its copies and want items have to go first.</p>
          <button type="submit" className="self-start rounded-md bg-danger-bg px-3 py-1 text-sm font-medium text-danger-text">
            Delete {album.title}
          </button>
        </form>
      </details>
    </section>
  );
}
