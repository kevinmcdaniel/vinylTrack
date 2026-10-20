import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiGet, ApiError } from '@/lib/api';
import { locationOptions, ownerOptions } from '@/lib/copyOptions';
import { showsPhysicalDetail } from '@/lib/filters';
import { requireActiveUser } from '@/lib/session';
import type { Album, Collection, Location, OwnerRow, WantItem } from '@/lib/types';
import { matchLines, wantPhrase, wantTitle } from '@/lib/wants';
import CopyForm from '@/ui/CopyForm';
import { createLocationInline, createOwnerInline } from '../../../copy/actions';
import { markFound } from '../../actions';

export const dynamic = 'force-dynamic';

const MESSAGES = {
  'invalid': 'Pick a location and an owner, both from this collection, and say which album it is.',
  'both': 'Pick an album from the list or type a new title, not both.',
  'not-found': 'That want was already marked found or removed.',
  'in-use': 'That location, owner or album no longer exists. Pick again.',
  'forbidden': 'You can’t add copies to this collection.',
};

const input = 'rounded-md border border-border bg-surface px-2 py-1 text-sm text-text';
const label = 'flex flex-col gap-1 text-sm text-text';

type Props = {
  params: Promise<{ wantId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Found it (#8): turn a want into a copy without re-entering it. The
 * duplicate check repeats at the top, as a warning only (#13): a second copy
 * is sometimes the point. The want is gone once this saves.
 */
export default async function FoundPage({ params, searchParams }: Props) {
  const [{ wantId }, { error }, me] = await Promise.all([params, searchParams, requireActiveUser()]);
  let want: WantItem;
  try {
    want = await apiGet<WantItem>(`/want/${encodeURIComponent(wantId)}`);
  } catch (e) {
    if (e instanceof ApiError && e.notFound) notFound();
    throw e;
  }
  const [collection, locations, owners, artistAlbums] = await Promise.all([
    apiGet<Collection>(`/collection/${encodeURIComponent(want.collectionId)}`),
    apiGet<Location[]>('/location', { collectionId: want.collectionId }),
    apiGet<OwnerRow[]>('/owner'),
    // An artist want doesn't name its album yet: offer theirs in this collection.
    want.album ? Promise.resolve([] as Album[]) : apiGet<Album[]>('/album', { collectionId: want.collectionId, artistId: want.artistId ?? '' }),
  ]);
  const myOwnerId = owners.find((o) => o.userId === me.id)?.id;
  const lines = matchLines(want, myOwnerId);
  const kind = collection.kind === 'digital' ? 'digital' : 'physical';
  const title = wantTitle(want);

  return (
    <section className="flex flex-col gap-4">
      <div>
        <Link href="/wants" className="text-sm text-primary underline">← Want list</Link>
        <h1 className="mt-2 font-display text-lg font-semibold">Found it: {title}</h1>
      </div>
      {lines.length > 0 ? (
        <div role="note" className="rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn-text">
          <p className="font-medium">Already in {collection.name}:</p>
          <ul className="mt-1 flex flex-col gap-0.5">{lines.map((line) => <li key={line}>{line}</li>)}</ul>
          <p className="mt-1">You can still add another copy.</p>
        </div>
      ) : (
        <p className="rounded-lg bg-surface-alt px-3 py-2 text-sm text-text-tertiary">
          Nobody in {collection.name} has {wantPhrase(want)} yet.
        </p>
      )}
      <CopyForm
        hidden={{ id: want.id, ...(want.album ? {} : { needsAlbum: '1' }) }}
        physical={showsPhysicalDetail(collection.kind)}
        locations={locationOptions(locations)}
        owners={ownerOptions(owners)}
        defaultOwnerId={myOwnerId}
        action={markFound}
        createLocation={createLocationInline.bind(null, collection.id, kind)}
        createOwner={createOwnerInline}
        submitLabel="Save — it’s found"
        error={typeof error === 'string' ? error : undefined}
        messages={MESSAGES}
      >
        {!want.album && (
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-sm text-text">Which album?</legend>
            <label className={label}>
              Album
              <select name="albumId" defaultValue="" className={input}>
                <option value="">A new album…</option>
                {artistAlbums.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
              </select>
            </label>
            <label className={label}>
              New album title
              <input name="newTitle" className={input} placeholder="Only if it isn’t in the list" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className={label}>
                Format
                <input name="format" className={input} />
              </label>
              <label className={label}>
                Year
                <input name="year" type="number" inputMode="numeric" min={1877} max={2100} className={input} />
              </label>
            </div>
          </fieldset>
        )}
      </CopyForm>
    </section>
  );
}
