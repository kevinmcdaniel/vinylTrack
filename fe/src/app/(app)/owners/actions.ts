'use server';

import { redirect } from 'next/navigation';
import { apiDelete, apiPatch, apiPost } from '@/lib/api';
import { actionErrorCode, type ActionErrorCode } from '@/lib/actionErrors';

const field = (formData: FormData, name: string) => {
  const v = formData.get(name);
  return typeof v === 'string' ? v.trim() : '';
};
const ownerPath = (formData: FormData) => `/owner/${encodeURIComponent(field(formData, 'id'))}`;

// redirect() throws, so it runs after the try: only the BE call's own refusal
// becomes an ?error= code, and anything unexpected reaches the error page.
async function run(write: () => Promise<unknown>) {
  let code: ActionErrorCode | undefined;
  try {
    await write();
  } catch (error) {
    code = actionErrorCode(error);
  }
  redirect(code ? `/owners?error=${code}` : '/owners');
}

// Name only: linking an owner to an account is the admin's call on
// /admin/requests (#102 task 0), so these forms never send userId.
export async function createOwner(formData: FormData) {
  await run(() => apiPost('/owner', { name: field(formData, 'name') }));
}

export async function renameOwner(formData: FormData) {
  await run(() => apiPatch(ownerPath(formData), { name: field(formData, 'name') }));
}

export async function deleteOwner(formData: FormData) {
  await run(() => apiDelete(ownerPath(formData)));
}
