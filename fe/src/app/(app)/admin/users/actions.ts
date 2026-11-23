'use server';

import { redirect } from 'next/navigation';
import { apiPost } from '@/lib/api';
import { actionErrorCode } from '@/lib/actionErrors';
import { requireAdmin } from '@/lib/session';

/** Deny an active account (#124): it lands on /pending as declined on its next request. */
export async function denyUser(formData: FormData) {
  await requireAdmin();
  const userId = formData.get('userId');
  let code: string | undefined;
  try {
    await apiPost(`/user/${encodeURIComponent(typeof userId === 'string' ? userId : '')}/deny`, {});
  } catch (error) {
    code = actionErrorCode(error);
  }
  redirect(code ? `/admin/users?error=${code}` : '/admin/users');
}
