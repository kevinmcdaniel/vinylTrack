'use server';

import { redirect } from 'next/navigation';
import { apiDelete, apiPatch, apiPost } from '@/lib/api';
import { actionErrorCode, type ActionErrorCode } from '@/lib/actionErrors';

const field = (formData: FormData, name: string) => {
  const v = formData.get(name);
  return typeof v === 'string' ? v.trim() : '';
};
const enc = encodeURIComponent;

// redirect() throws, so it runs after the try: only the BE's own refusal
// becomes an ?error= code, and anything unexpected reaches the error page.
async function attempt(write: () => Promise<unknown>): Promise<ActionErrorCode | undefined> {
  try {
    await write();
    return undefined;
  } catch (error) {
    return actionErrorCode(error);
  }
}

// `back` is form data, so only a want-list URL is honored: never an open redirect.
// An earlier refusal's ?error= is dropped, so the page shows only this one.
const backTo = (formData: FormData) => {
  const back = field(formData, 'back');
  if (!/^\/wants(\?|$)/.test(back)) return '/wants';
  const url = new URL(back, 'http://local');
  url.searchParams.delete('error');
  return url.pathname + url.search;
};
const withError = (url: string, code: ActionErrorCode) => `${url}${url.includes('?') ? '&' : '?'}error=${code}`;

/**
 * Add to the want list (#8): an album or "anything by" an artist. An album or
 * artist that isn't in the catalog yet is created first — a record nobody has
 * ever owned becomes an album with no copies (decision 2 on #8). Only the half
 * of the form `kind` names is read; the other half may still hold values.
 */
export async function createWant(formData: FormData) {
  const collectionId = field(formData, 'collectionId');
  const kind = field(formData, 'kind');
  const want: Record<string, unknown> = { collectionId, priority: field(formData, 'priority') };
  if (field(formData, 'notes')) want.notes = field(formData, 'notes');
  const form = `/wants/new?collectionId=${enc(collectionId)}`;

  const albumId = field(formData, 'albumId');
  const newTitle = field(formData, 'newTitle');
  const artistId = field(formData, 'artistId');
  const newArtist = field(formData, 'newArtist');
  const picked = kind === 'album' ? albumId || newTitle : kind === 'artist' ? artistId || newArtist : '';
  if (!picked) redirect(withError(form, 'invalid'));

  const code = await attempt(async () => {
    if (kind === 'album') {
      want.albumId = albumId || (await apiPost<{ id: string }>('/album', {
        collectionId,
        title: newTitle,
        artistIds: formData.getAll('artistIds').filter((v): v is string => typeof v === 'string' && v !== ''),
      })).id;
    } else {
      want.artistId = artistId || (await apiPost<{ id: string }>('/artist', { name: newArtist })).id;
    }
    await apiPost('/want', want);
  });
  redirect(code ? withError(form, code) : `/wants?collectionId=${enc(collectionId)}`);
}

/** Priority and notes, from the list row's Edit (#8). A blank note clears it. */
export async function updateWant(formData: FormData) {
  const back = backTo(formData);
  const code = await attempt(() => apiPatch(`/want/${enc(field(formData, 'id'))}`, {
    priority: field(formData, 'priority'),
    notes: field(formData, 'notes') || null,
  }));
  redirect(code ? withError(back, code) : back);
}

export async function deleteWant(formData: FormData) {
  const back = backTo(formData);
  const code = await attempt(() => apiDelete(`/want/${enc(field(formData, 'id'))}`));
  redirect(code ? withError(back, code) : back);
}
