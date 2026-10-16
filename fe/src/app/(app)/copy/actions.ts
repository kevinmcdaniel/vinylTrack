'use server';

import { redirect } from 'next/navigation';
import { apiDelete, apiPatch, apiPost } from '@/lib/api';
import { actionErrorCode, type ActionErrorCode } from '@/lib/actionErrors';

const field = (formData: FormData, name: string) => {
  const v = formData.get(name);
  return typeof v === 'string' ? v.trim() : '';
};
const enc = encodeURIComponent;
// A date-only string 500s at the BE (Prisma wants a full DateTime), so the
// picked day goes out as midnight UTC.
const day = (formData: FormData) => (/^\d{4}-\d{2}-\d{2}$/.test(field(formData, 'dateAcquired')) ? `${field(formData, 'dateAcquired')}T00:00:00.000Z` : null);
const price = (formData: FormData) => {
  const n = Number(field(formData, 'price'));
  return field(formData, 'price') && Number.isFinite(n) && n >= 0 ? n : null;
};
const TEXT = ['condition', 'notes'] as const;

async function attempt(write: () => Promise<unknown>): Promise<ActionErrorCode | undefined> {
  try {
    await write();
    return undefined;
  } catch (error) {
    return actionErrorCode(error);
  }
}

export async function createCopy(formData: FormData) {
  const albumId = field(formData, 'albumId');
  const body: Record<string, unknown> = { albumId, locationId: field(formData, 'locationId'), ownerId: field(formData, 'ownerId') };
  for (const name of TEXT) if (field(formData, name)) body[name] = field(formData, name);
  if (day(formData)) body.dateAcquired = day(formData);
  if (price(formData) !== null) body.price = price(formData);
  const code = await attempt(() => apiPost('/copy', body));
  redirect(code ? `/album/${enc(albumId)}/copy/new?error=${code}` : `/album/${enc(albumId)}`);
}

// A blank optional field clears it (null); location and owner are always sent.
export async function updateCopy(formData: FormData) {
  const id = field(formData, 'id');
  const body: Record<string, unknown> = { locationId: field(formData, 'locationId'), ownerId: field(formData, 'ownerId') };
  for (const name of TEXT) body[name] = field(formData, name) || null;
  body.dateAcquired = day(formData);
  body.price = price(formData);
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
