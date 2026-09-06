import Link from 'next/link';

export const dynamic = 'force-dynamic';

/**
 * Mobile-first shell. This is the screen you use standing in a record store,
 * so the chrome stays out of the way: a title bar and whatever the page needs.
 *
 * Deliberately fetches nothing. Each page owns its own empty state — `/` for
 * having no collections at all, the collection page for an empty or
 * over-filtered list, the artist page for an artist you can see no releases
 * for — so a `/collection` round trip here would be paid on every navigation
 * to say something the page underneath already says better.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col">
      <header className="sticky top-0 z-10 border-b border-black/10 bg-[var(--background)] px-4 py-3 dark:border-white/15">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          vinylTrack
        </Link>
      </header>
      <main className="flex-1 px-4 py-4">{children}</main>
    </div>
  );
}
