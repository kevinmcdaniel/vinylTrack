/**
 * Every route in this group is `force-dynamic` and fetches on the server, so
 * without a fallback a navigation shows nothing until the new page paints —
 * most obvious on the phone this UI is built for, where switching collections
 * or applying a filter otherwise looks like it did nothing.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="h-10 animate-pulse rounded-md bg-black/5 dark:bg-white/10" />
      <div className="h-10 animate-pulse rounded-md bg-black/5 dark:bg-white/10" />
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-8 flex-1 animate-pulse rounded-md bg-black/5 dark:bg-white/10" />
        ))}
      </div>
      <ul className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className="h-16 animate-pulse rounded-lg bg-black/5 dark:bg-white/10" />
        ))}
      </ul>
    </div>
  );
}
