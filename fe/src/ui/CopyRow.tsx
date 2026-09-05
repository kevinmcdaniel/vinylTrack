import LocationPath from './LocationPath';
import { showsPhysicalDetail } from '@/lib/filters';
import type { Copy } from '@/lib/types';

const formatAcquired = (copy: Copy): string | null => {
  const parts: string[] = [];
  if (copy.source) parts.push(copy.source.name);
  if (copy.dateAcquired) parts.push(new Date(copy.dateAcquired).toLocaleDateString());
  if (copy.price) parts.push(`$${Number(copy.price).toFixed(2)}`);
  return parts.length ? parts.join(' · ') : null;
};

/**
 * One owned instance. A title can have several (mine and my kid's, #13), so
 * these are always rendered as a list — never collapsed to "owned: yes".
 */
export default function CopyRow({ copy, collectionKind }: { copy: Copy; collectionKind: string }) {
  const physical = showsPhysicalDetail(collectionKind);
  const acquired = physical ? formatAcquired(copy) : null;
  return (
    <li className="rounded-lg border border-black/10 p-3 dark:border-white/15">
      <LocationPath location={copy.location} />
      {physical && copy.condition && (
        <span className="ml-2 rounded bg-black/5 px-1.5 py-0.5 text-xs dark:bg-white/10">
          {copy.condition}
        </span>
      )}
      {acquired && <div className="mt-1 text-xs opacity-60">{acquired}</div>}
      {copy.notes && <div className="mt-1 text-sm opacity-80">{copy.notes}</div>}
    </li>
  );
}
