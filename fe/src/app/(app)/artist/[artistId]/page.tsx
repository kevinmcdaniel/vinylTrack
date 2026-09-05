import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiGet, ApiError } from '@/lib/api';
import EmptyState from '@/ui/EmptyState';
import type { ArtistDetail } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ArtistPage({ params }: { params: Promise<{ artistId: string }> }) {
  const { artistId } = await params;

  let artist: ArtistDetail;
  try {
    artist = await apiGet<ArtistDetail>(`/artist/${artistId}`);
  } catch (error) {
    if (error instanceof ApiError && error.notFound) notFound();
    throw error;
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold leading-tight">{artist.name}</h1>
        {artist.notes && <p className="mt-2 text-sm opacity-80">{artist.notes}</p>}
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide opacity-55">
          {artist.albums.length} {artist.albums.length === 1 ? 'release' : 'releases'}
        </h2>
        {artist.albums.length === 0 ? (
          <EmptyState>Nothing by {artist.name} in the collections you can see.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {artist.albums.map((album) => {
              const meta = [album.format, album.year].filter(Boolean).join(' · ');
              return (
                <li key={album.id}>
                  <Link
                    href={`/album/${album.id}`}
                    className="block rounded-lg border border-black/10 p-3 active:bg-black/5 dark:border-white/15 dark:active:bg-white/5"
                  >
                    <div className="font-medium leading-snug">{album.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      {/* An artist spans collections, so say which one this is in (#7). */}
                      <span className="rounded bg-black/5 px-1.5 py-0.5 dark:bg-white/10">
                        {album.collection.name}
                      </span>
                      {meta && <span className="uppercase tracking-wide opacity-55">{meta}</span>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
