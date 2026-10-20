'use server';

import { redirect } from 'next/navigation';
import { apiDelete, apiPatch, apiPost } from '@/lib/api';
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

export async function createCopy(formData: FormData) {
  const albumId = field(formData, 'albumId');
  const body: Record<string, unknown> = { albumId, locationId: field(formData, 'locationId'), ownerId: field(formData, 'ownerId') };
  for (const name of TEXT) if (field(formData, name)) body[name] = field(formData, name);
  const [day, price] = [dayOf(formData), priceOf(formData)];
  if (day) body.dateAcquired = day;
  if (price !== null) body.price = price;
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
