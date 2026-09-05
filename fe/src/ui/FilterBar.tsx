'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export type FilterOptions = {
  artists: { id: string; name: string }[];
  formats: string[];
  genres: string[];
};

const SELECTS = [
  { key: 'format', label: 'Any format' },
  { key: 'genre', label: 'Any genre' },
] as const;

/**
 * Filters live in the URL, not component state: the list is fetched on the
 * server, so changing a filter is a navigation. That also makes any filtered
 * view shareable and back-button friendly.
 */
export default function FilterBar({ options }: { options: FilterOptions }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const q = params.get('q') ?? '';

  const navigate = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  };

  const selectValues: Record<string, string[]> = { format: options.formats, genre: options.genres };
  const hasFilters = ['q', 'artistId', 'format', 'genre'].some((k) => params.get(k));

  return (
    <div className="flex flex-col gap-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const value = new FormData(e.currentTarget).get('q');
          navigate('q', typeof value === 'string' ? value.trim() : '');
        }}
      >
        {/* Uncontrolled with a key: the URL owns the committed query, the input
            owns the in-progress one, and keying on q resets the draft whenever
            the URL changes underneath us (back button, collection switch). */}
        <input
          key={q}
          name="q"
          type="search"
          aria-label="Search by title"
          placeholder="Search by title"
          defaultValue={q}
          className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-base dark:border-white/20"
        />
      </form>

      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Artist"
          value={params.get('artistId') ?? ''}
          onChange={(e) => navigate('artistId', e.target.value)}
          className="flex-1 rounded-md border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/20"
        >
          <option value="">Any artist</option>
          {options.artists.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>

        {SELECTS.map(({ key, label }) => (
          <select
            key={key}
            aria-label={key === 'format' ? 'Format' : 'Genre'}
            value={params.get(key) ?? ''}
            onChange={(e) => navigate(key, e.target.value)}
            className="flex-1 rounded-md border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/20"
          >
            <option value="">{label}</option>
            {selectValues[key].map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        ))}
      </div>

      {hasFilters && (
        <button
          type="button"
          onClick={() => router.push(pathname)}
          className="self-start text-sm underline opacity-70"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
