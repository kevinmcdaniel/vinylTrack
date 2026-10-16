'use server';

import { redirect } from 'next/navigation';
import { apiDelete, apiPatch, apiPost } from '@/lib/api';
import { actionErrorCode, type ActionErrorCode } from '@/lib/actionErrors';

const field = (formData: FormData, name: string) => {
  const v = formData.get(name);
  return typeof v === 'string' ? v.trim() : '';
};
const back = (formData: FormData) => `/collection/${encodeURIComponent(field(formData, 'collectionId'))}/locations`;
const locationPath = (formData: FormData) => `/location/${encodeURIComponent(field(formData, 'id'))}`;

// The hidden collectionId only picks where to land afterwards; the BE decides
// access from the location (or, on create, from that id) itself.
async function run(formData: FormData, write: () => Promise<unknown>) {
  let code: ActionErrorCode | undefined;
  try {
    await write();
  } catch (error) {
    code = actionErrorCode(error);
  }
  redirect(code ? `${back(formData)}?error=${code}` : back(formData));
}

export async function createLocation(formData: FormData) {
  const parentLocationId = field(formData, 'parentLocationId');
  await run(formData, () => apiPost('/location', {
    collectionId: field(formData, 'collectionId'),
    name: field(formData, 'name'),
    kind: field(formData, 'kind'),
    ...(parentLocationId ? { parentLocationId } : {}),
  }));
}

// "No parent" is null, not omitted, so a shelf can move back to the top level.
export async function updateLocation(formData: FormData) {
  await run(formData, () => apiPatch(locationPath(formData), {
    name: field(formData, 'name'),
    kind: field(formData, 'kind'),
    parentLocationId: field(formData, 'parentLocationId') || null,
  }));
}

export async function deleteLocation(formData: FormData) {
  await run(formData, () => apiDelete(locationPath(formData)));
}
