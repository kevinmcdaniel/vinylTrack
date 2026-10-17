'use server';

import { redirect } from 'next/navigation';
import { apiDelete, apiPatch, apiPost } from '@/lib/api';
import { actionErrorCode, type ActionErrorCode } from '@/lib/actionErrors';

const field = (formData: FormData, name: string) => {
  const v = formData.get(name);
  return typeof v === 'string' ? v.trim() : '';
};
const enc = encodeURIComponent;
const artistIds = (formData: FormData) =>
  formData.getAll('artistIds').filter((v): v is string => typeof v === 'string' && v !== '');
const year = (formData: FormData) => {
  const n = Number.parseInt(field(formData, 'year'), 10);
  return Number.isFinite(n) ? n : null;
};
const OPTIONAL = ['format', 'genre', 'notes'] as const;

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

export async function createAlbum(formData: FormData) {
  const collectionId = field(formData, 'collectionId');
  let id = '';
  const body: Record<string, unknown> = { collectionId, title: field(formData, 'title') };
  for (const name of OPTIONAL) if (field(formData, name)) body[name] = field(formData, name);
  if (year(formData) !== null) body.year = year(formData);
  body.artistIds = artistIds(formData);
  const code = await attempt(async () => { id = (await apiPost<{ id: string }>('/album', body)).id; });
  redirect(code ? `/collection/${enc(collectionId)}/album/new?error=${code}` : `/album/${enc(id)}`);
}

// A blank field clears the value (null), and the artist list is replaced whole.
export async function updateAlbum(formData: FormData) {
  const id = field(formData, 'id');
  const body: Record<string, unknown> = { title: field(formData, 'title') };
  for (const name of OPTIONAL) body[name] = field(formData, name) || null;
  body.year = year(formData);
  body.artistIds = artistIds(formData);
  const code = await attempt(() => apiPatch(`/album/${enc(id)}`, body));
  redirect(code ? `/album/${enc(id)}/edit?error=${code}` : `/album/${enc(id)}`);
}

export async function deleteAlbum(formData: FormData) {
  const id = field(formData, 'id');
  const code = await attempt(() => apiDelete(`/album/${enc(id)}`));
  redirect(code ? `/album/${enc(id)}/edit?error=${code}` : `/collection/${enc(field(formData, 'collectionId'))}`);
}

export type CreateArtistResult = { artist: { id: string; name: string } } | { error: ActionErrorCode };

/** For ArtistPicker's "add": answers rather than redirects, so the form keeps its state. */
export async function createArtist(name: string): Promise<CreateArtistResult> {
  try {
    const artist = await apiPost<{ id: string; name: string }>('/artist', { name: name.trim() });
    return { artist: { id: artist.id, name: artist.name } };
  } catch (error) {
    return { error: actionErrorCode(error) };
  }
}
