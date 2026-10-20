import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiGet, ApiError } from '@/lib/api';
import { locationPath, showsPhysicalDetail } from '@/lib/filters';
import CopyRow from '@/ui/CopyRow';
import EmptyState from '@/ui/EmptyState';
import type { AlbumDetail } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ albumId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AlbumPage({ params, searchParams }: Props) {
  const [{ albumId }, query] = await Promise.all([params, searchParams ?? Promise.resolve<Record<string, string | string[] | undefined>>({})]);

  let album: AlbumDetail;
  try {
    album = await apiGet<AlbumDetail>(`/album/${albumId}`);
  } catch (error) {
    if (error instanceof ApiError && error.notFound) notFound();
    throw error;
  }

  const meta = [album.format, album.year, album.genre].filter(Boolean).join(' · ');
  const physical = showsPhysicalDetail(album.collection.kind);
  // After Found it (#8): `?found=<copy id>`, honored only for one of this album's copies.
  const found = album.copies.find((c) => c.id === query.found);

  return (
    <div className="flex flex-col gap-5">
      {found && (
        <p role="status" className="rounded-lg bg-success-bg px-3 py-2 text-sm text-accent-green">
          Found it — added {found.owner.name}’s copy: {locationPath(found.location)}. It’s off the want list.
        </p>
      )}
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <Link href={`/collection/${album.collectionId}`} className="text-sm underline opacity-70">
            ← {album.collection.name}
          </Link>
          <Link href={`/album/${encodeURIComponent(album.id)}/edit`} className="text-sm text-primary underline">Edit</Link>
        </div>
        <h1 className="mt-2 text-2xl font-semibold leading-tight">{album.title}</h1>
        {album.artists.length > 0 && (
          <p className="mt-1 text-sm">
            {album.artists.map((artist, i) => (
              <span key={artist.id}>
                {i > 0 && ', '}
                <Link href={`/artist/${artist.id}`} className="underline">
                  {artist.name}
                </Link>
              </span>
            ))}
          </p>
        )}
        {meta && <p className="mt-1 text-xs uppercase tracking-wide opacity-55">{meta}</p>}
        {album.notes && <p className="mt-2 text-sm opacity-80">{album.notes}</p>}
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide opacity-55">
            {album.copies.length} {album.copies.length === 1 ? 'copy' : 'copies'}
            {physical ? '' : ' · stored digitally'}
          </h2>
          <span className="flex gap-3">
            <Link href={`/album/${encodeURIComponent(album.id)}/copy/new`} className="text-sm text-primary underline">Add copy</Link>
            <Link
              href={`/wants/new?collectionId=${encodeURIComponent(album.collectionId)}&albumId=${encodeURIComponent(album.id)}`}
              className="text-sm text-primary underline"
            >
              Add to want list
            </Link>
          </span>
        </div>
        {album.copies.length === 0 ? (
          <EmptyState>Nobody owns a copy of this yet.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {album.copies.map((copy) => (
              <CopyRow key={copy.id} copy={copy} collectionKind={album.collection.kind} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
