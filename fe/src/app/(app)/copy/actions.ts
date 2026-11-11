'use server';

import { redirect } from 'next/navigation';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';
import { ApiError } from '@/lib/apiError';
import { actionErrorCode, type ActionErrorCode } from '@/lib/actionErrors';
import { dayOf, field, priceOf } from '@/lib/formFields';

const enc = encodeURIComponent;
const TEXT = ['condition', 'notes'] as const;

async function attempt(write: () => Promise<unknown>): Promise<ActionErrorCode | undefined> {
  try {
    await write();
    return undefined;
  } catch (error) {
    return actionErrorCode(error);
  }
}

// The copy half of a new-copy form: location and owner always, blank optional fields left out.
function copyBody(formData: FormData): Record<string, unknown> {
  const body: Record<string, unknown> = { locationId: field(formData, 'locationId'), ownerId: field(formData, 'ownerId') };
  for (const name of TEXT) if (field(formData, name)) body[name] = field(formData, name);
  const [day, price] = [dayOf(formData), priceOf(formData)];
  if (day) body.dateAcquired = day;
  if (price !== null) body.price = price;
  return body;
}

export async function createCopy(formData: FormData) {
  const albumId = field(formData, 'albumId');
  const body = { albumId, ...copyBody(formData) };
  const code = await attempt(() => apiPost('/copy', body));
  redirect(code ? `/album/${enc(albumId)}/copy/new?error=${code}` : `/album/${enc(albumId)}`);
}

// A blank optional field clears it (null); location and owner are always sent.
export async function updateCopy(formData: FormData) {
  const id = field(formData, 'id');
  const body: Record<string, unknown> = { locationId: field(formData, 'locationId'), ownerId: field(formData, 'ownerId') };
  for (const name of TEXT) body[name] = field(formData, name) || null;
  body.dateAcquired = dayOf(formData);
  body.price = priceOf(formData);
  const code = await attempt(() => apiPatch(`/copy/${enc(id)}`, body));
  redirect(code ? `/copy/${enc(id)}/edit?error=${code}` : `/album/${enc(field(formData, 'albumId'))}`);
}

export async function deleteCopy(formData: FormData) {
  const id = field(formData, 'id');
  const code = await attempt(() => apiDelete(`/copy/${enc(id)}`));
  redirect(code ? `/copy/${enc(id)}/edit?error=${code}` : `/album/${enc(field(formData, 'albumId'))}`);
}

export type PickResult = { item: { id: string; label: string } } | { error: ActionErrorCode };

async function answer(write: () => Promise<{ id: string; name: string }>): Promise<PickResult> {
  try {
    const row = await write();
    return { item: { id: row.id, label: row.name } };
  } catch (error) {
    return { error: actionErrorCode(error) };
  }
}

/** PickOrAdd's "add an owner": name only, never userId (#107). */
export async function createOwnerInline(name: string): Promise<PickResult> {
  return answer(() => apiPost('/owner', { name: name.trim() }));
}

/** PickOrAdd's "add a location": top level, of the collection's kind. */
export async function createLocationInline(collectionId: string, kind: string, name: string): Promise<PickResult> {
  return answer(() => apiPost('/location', { collectionId, name: name.trim(), kind }));
}

const ALBUM_TEXT = ['format', 'genre'] as const;

/**
 * Add a copy from the collection page (#123): an album already there, or a
 * new one created with the copy in one request. Reads only the half the
 * Existing/New choice names; the other half's fields are ignored.
 */
export async function addCopy(formData: FormData) {
  const collectionId = field(formData, 'collectionId');
  const isNew = field(formData, 'albumMode') === 'new';
  const back = (code: string) => `/collection/${enc(collectionId)}/copy/new?error=${code}${isNew ? '&mode=new' : ''}`;
  let album: Record<string, unknown> | undefined;
  if (isNew) {
    const title = field(formData, 'albumTitle');
    if (!title) redirect(back('title'));
    album = { collectionId, title };
    for (const name of ALBUM_TEXT) if (field(formData, name)) album[name] = field(formData, name);
    const year = Number.parseInt(field(formData, 'year'), 10);
    if (Number.isFinite(year)) album.year = year;
    if (field(formData, 'albumNotes')) album.notes = field(formData, 'albumNotes');
    album.artistIds = formData.getAll('artistIds').filter((v): v is string => typeof v === 'string' && v !== '');
  } else if (!field(formData, 'albumId')) {
    redirect(back('pick-album'));
  }
  const body = { ...(album ? { album } : { albumId: field(formData, 'albumId') }), ...copyBody(formData) };
  let created = { id: '', albumId: '' };
  const code = await attempt(async () => { created = await apiPost<{ id: string; albumId: string }>('/copy', body); });
  redirect(code ? back(code) : `/album/${enc(created.albumId)}?added=${enc(created.id)}`);
}

export type AlbumRow = { id: string; title: string; year: number | null; artists: string[] };
type BeAlbum = { id: string; title: string; year: number | null; artists: { id: string; name: string }[] };
const toRow = ({ id, title, year, artists }: BeAlbum): AlbumRow => ({ id, title, year, artists: artists.map((a) => a.name) });

// Both answer the page's JS as you type. A refusal or outage shows nothing
// rather than an error: search has a no-JS fallback, and the warning only warns.
const quietly = async <T,>(read: () => Promise<T[]>): Promise<T[]> => {
  try {
    return await read();
  } catch (error) {
    if (error instanceof ApiError) return [];
    throw error;
  }
};

/** The Existing album search (#123): this collection's albums by title, up to 20. */
export async function searchAlbums(collectionId: string, q: string): Promise<AlbumRow[]> {
  if (!q.trim()) return [];
  return quietly(async () => (await apiGet<BeAlbum[]>('/album', { collectionId, q: q.trim() })).slice(0, 20).map(toRow));
}

export type AlbumMatch = AlbumRow & { copyCount: number };

/** The New album duplicate warning (#123): look-alikes already in this collection. */
export async function findAlbumMatches(collectionId: string, title: string, artistIds: string[]): Promise<AlbumMatch[]> {
  if (!title.trim()) return [];
  return quietly(async () => (await apiGet<(BeAlbum & { copyCount: number })[]>('/album/matches', {
    collectionId, title: title.trim(), artistIds: artistIds.join(','),
  })).map((a) => ({ ...toRow(a), copyCount: a.copyCount })));
}
