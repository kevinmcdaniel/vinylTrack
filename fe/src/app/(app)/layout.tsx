import Link from 'next/link';
import { apiGet } from '@/lib/api';
import type { Collection } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Mobile-first shell. This is the screen you use standing in a record store,
 * so the chrome stays out of the way: a title bar and whatever the page needs.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const collections = await apiGet<Collection[]>('/collection');
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col">
      <header className="sticky top-0 z-10 border-b border-black/10 bg-[var(--background)] px-4 py-3 dark:border-white/15">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          vinylTrack
        </Link>
      </header>
      <main className="flex-1 px-4 py-4">{children}</main>
      {collections.length === 0 && (
        <footer className="px-4 pb-6 text-sm opacity-70">No collections are shared with you yet.</footer>
      )}
    </div>
  );
}
