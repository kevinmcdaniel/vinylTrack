import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiGet, ApiError } from '@/lib/api';
import { showsPhysicalDetail } from '@/lib/filters';
import CopyRow from '@/ui/CopyRow';
import EmptyState from '@/ui/EmptyState';
import type { AlbumDetail } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function AlbumPage({ params }: { params: Promise<{ albumId: string }> }) {
  const { albumId } = await params;

  let album: AlbumDetail;
  try {
    album = await apiGet<AlbumDetail>(`/album/${albumId}`);
  } catch (error) {
    if (error instanceof ApiError && error.notFound) notFound();
    throw error;
  }

  const meta = [album.format, album.year, album.genre].filter(Boolean).join(' · ');
  const physical = showsPhysicalDetail(album.collection.kind);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href={`/collection/${album.collectionId}`} className="text-sm underline opacity-70">
          ← {album.collection.name}
        </Link>
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
        <h2 className="text-xs font-semibold uppercase tracking-wide opacity-55">
          {album.copies.length} {album.copies.length === 1 ? 'copy' : 'copies'}
          {physical ? '' : ' · stored digitally'}
        </h2>
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
