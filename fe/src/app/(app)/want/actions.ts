'use server';

import { redirect } from 'next/navigation';
import { apiPost } from '@/lib/api';
import { actionErrorCode, type ActionErrorCode } from '@/lib/actionErrors';
import { dayOf, field, priceOf } from '@/lib/formFields';

const enc = encodeURIComponent;

/**
 * Found it (#8): the want becomes a copy, and the BE removes the want in the
 * same transaction. An artist want (`needsAlbum`) also says which album:
 * one already in the collection, or a new title, never both. On success the
 * album page opens with `?found=<copy id>` so it can say what just happened.
 */
export async function markFound(formData: FormData) {
  const id = field(formData, 'id');
  const form = `/want/${enc(id)}/found`;
  const body: Record<string, unknown> = { locationId: field(formData, 'locationId'), ownerId: field(formData, 'ownerId') };
  for (const name of ['condition', 'notes'] as const) if (field(formData, name)) body[name] = field(formData, name);
  if (dayOf(formData)) body.dateAcquired = dayOf(formData);
  if (priceOf(formData) !== null) body.price = priceOf(formData);

  if (field(formData, 'needsAlbum')) {
    const [albumId, title] = [field(formData, 'albumId'), field(formData, 'newTitle')];
    if (!albumId && !title) redirect(`${form}?error=invalid`);
    if (albumId && title) redirect(`${form}?error=both`);
    if (albumId) {
      body.albumId = albumId;
    } else {
      const album: Record<string, unknown> = { title };
      if (field(formData, 'format')) album.format = field(formData, 'format');
      const year = Number.parseInt(field(formData, 'year'), 10);
      if (Number.isFinite(year)) album.year = year;
      body.album = album;
    }
  }

  let target = '';
  let code: ActionErrorCode | undefined;
  try {
    const result = await apiPost<{ copy: { id: string }; album: { id: string } }>(`/want/${enc(id)}/found`, body);
    target = `/album/${enc(result.album.id)}?found=${enc(result.copy.id)}`;
  } catch (error) {
    code = actionErrorCode(error);
  }
  // redirect() throws, so it runs after the try.
  redirect(code ? `${form}?error=${code}` : target);
}
