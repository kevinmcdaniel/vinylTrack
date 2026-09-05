import Link from 'next/link';
import type { Album } from '@/lib/types';

/** One row in the collection list. Mobile-first: a tap target, not a table row. */
export default function AlbumCard({ album }: { album: Album }) {
  const meta = [album.format, album.year, album.genre].filter(Boolean).join(' · ');
  return (
    <Link
      href={`/album/${album.id}`}
      className="block rounded-lg border border-black/10 p-3 active:bg-black/5 dark:border-white/15 dark:active:bg-white/5"
    >
      <div className="font-medium leading-snug">{album.title}</div>
      {album.artists.length > 0 && (
        <div className="mt-0.5 text-sm opacity-80">{album.artists.map((a) => a.name).join(', ')}</div>
      )}
      {meta && <div className="mt-1 text-xs uppercase tracking-wide opacity-55">{meta}</div>}
    </Link>
  );
}
