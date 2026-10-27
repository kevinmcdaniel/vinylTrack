'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * A header dropdown on a plain <details>, so it opens before any JS loads
 * (#124). JS only closes it: on navigation (the header lives in the layout,
 * which client navigation keeps mounted), on a tap outside, and on Escape.
 */
export default function MenuDisclosure({ summary, label, children }: {
  summary: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);

  useEffect(() => {
    const close = () => { if (ref.current) ref.current.open = false; };
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <details ref={ref} className="relative">
      <summary
        aria-label={label}
        className="flex cursor-pointer list-none items-center gap-1 rounded-md px-1 py-0.5 text-text-secondary [&::-webkit-details-marker]:hidden"
      >
        {summary}
        <span aria-hidden className="text-[10px]">▾</span>
      </summary>
      <div className="absolute right-0 z-20 mt-2 flex w-64 max-w-[calc(100vw-2rem)] flex-col gap-3 rounded-lg border border-border bg-surface p-3 text-sm shadow-lg">
        {children}
      </div>
    </details>
  );
}
