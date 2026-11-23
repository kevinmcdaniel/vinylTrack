'use client';

import { useRef, type ReactNode } from 'react';

/** Below this many rows a filter box is clutter. */
export const FILTER_FROM = 15;

/**
 * A filter box over a long list (#137). The server renders every row; this
 * only hides the `li[data-filter]` rows that don't match, so the list works
 * before JS loads and the box is just a convenience.
 */
export default function RowFilter({ label, count, children }: { label: string; count: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  if (count < FILTER_FROM) return <>{children}</>;
  const filter = (value: string) => {
    const q = value.trim().toLowerCase();
    ref.current?.querySelectorAll<HTMLLIElement>('li[data-filter]').forEach((li) => {
      li.hidden = q !== '' && !(li.dataset.filter ?? '').includes(q);
    });
  };
  return (
    <div ref={ref} className="flex flex-col gap-2">
      <input
        type="search"
        aria-label={label}
        placeholder={label}
        onChange={(e) => filter(e.target.value)}
        className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-text"
      />
      {children}
    </div>
  );
}
