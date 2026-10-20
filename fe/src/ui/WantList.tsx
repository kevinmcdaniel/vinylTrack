import type { WantItem } from '@/lib/types';
import { groupWants, matchLines, wantArtists, wantTitle } from '@/lib/wants';

/**
 * Must-have, then nice-to-have (#8). Each row carries its duplicate check
 * (#13): who already has it and where, or which collection came up empty, so
 * "nobody has it" never claims more than what is shared with you.
 */
export default function WantList({
  wants,
  collectionNames,
  showCollection,
}: {
  wants: WantItem[];
  collectionNames: Map<string, string>;
  showCollection: boolean;
}) {
  if (wants.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-text-muted">
        Nothing on the want list.
      </p>
    );
  }
  const { mustHave, niceToHave } = groupWants(wants);
  return (
    <div className="flex flex-col gap-6">
      <Group title="Must-have" wants={mustHave} collectionNames={collectionNames} showCollection={showCollection} />
      <Group title="Nice-to-have" wants={niceToHave} collectionNames={collectionNames} showCollection={showCollection} />
    </div>
  );
}

function Group({
  title,
  wants,
  collectionNames,
  showCollection,
}: {
  title: string;
  wants: WantItem[];
  collectionNames: Map<string, string>;
  showCollection: boolean;
}) {
  if (wants.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        {title} <span className="font-mono">({wants.length})</span>
      </h2>
      <ul className="flex flex-col gap-2">
        {wants.map((want) => {
          const lines = matchLines(want);
          const collection = collectionNames.get(want.collectionId) ?? 'this collection';
          const artists = wantArtists(want);
          return (
            <li key={want.id} className="rounded-xl border border-border bg-surface p-3">
              <p className="font-medium leading-snug text-text">{wantTitle(want)}</p>
              {artists && <p className="text-sm text-text-secondary">{artists}</p>}
              {showCollection && <p className="mt-0.5 text-xs text-text-muted">{collection}</p>}
              {want.notes && <p className="mt-1 text-sm text-text-muted">{want.notes}</p>}
              {lines.length > 0 ? (
                <ul className="mt-2 flex flex-col gap-1 rounded-lg bg-warn-bg px-2 py-1.5 text-sm text-warn-text">
                  {lines.map((line) => <li key={line}>{line}</li>)}
                </ul>
              ) : (
                <p className="mt-2 rounded-lg bg-surface-alt px-2 py-1.5 text-sm text-text-tertiary">No copies in {collection}</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
