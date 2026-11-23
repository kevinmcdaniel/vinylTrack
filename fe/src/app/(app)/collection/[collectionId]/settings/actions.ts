'use server';

import { redirect } from 'next/navigation';
import { apiDelete, apiPatch, apiPost } from '@/lib/api';
import { actionErrorCode, type ActionErrorCode } from '@/lib/actionErrors';
import { field } from '@/lib/formFields';

const enc = encodeURIComponent;

// Every settings form lands back on the settings page (#125): ?saved=<form>
// on success, ?error=<form>-<code> on an expected refusal. redirect() runs
// after the try, so only the BE's own refusals become codes.
async function settle(id: string, form: 'rename' | 'share' | 'unshare', write: () => Promise<unknown>) {
  let code: ActionErrorCode | undefined;
  try {
    await write();
  } catch (error) {
    code = actionErrorCode(error);
  }
  redirect(`/collection/${enc(id)}/settings?${code ? `error=${form}-${code}` : `saved=${form}`}`);
}

/** Rename and re-note; a blank note clears it. kind stays fixed. */
export async function renameCollection(formData: FormData) {
  const id = field(formData, 'id');
  await settle(id, 'rename', () => apiPatch(`/collection/${enc(id)}`, {
    name: field(formData, 'name'),
    notes: field(formData, 'notes') || null,
  }));
}

export async function shareCollection(formData: FormData) {
  const id = field(formData, 'id');
  const userId = field(formData, 'userId');
  if (!userId) redirect(`/collection/${enc(id)}/settings?error=share-invalid`);
  await settle(id, 'share', () => apiPost(`/collection/${enc(id)}/share`, { userId }));
}

export async function unshareCollection(formData: FormData) {
  const id = field(formData, 'id');
  await settle(id, 'unshare', () => apiDelete(`/collection/${enc(id)}/share/${enc(field(formData, 'userId'))}`));
}
