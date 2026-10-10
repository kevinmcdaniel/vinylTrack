'use server';

import { revalidatePath } from 'next/cache';
import { apiPost } from '@/lib/api';
import { requireAdmin } from '@/lib/session';

const field = (formData: FormData, name: string) => {
  const v = formData.get(name);
  return typeof v === 'string' ? v : '';
};

export async function approveRequest(formData: FormData) {
  await requireAdmin();
  const ownerId = field(formData, 'ownerId');
  await apiPost(`/user/${encodeURIComponent(field(formData, 'userId'))}/approve`, ownerId ? { ownerId } : {});
  revalidatePath('/admin/requests');
}

export async function denyRequest(formData: FormData) {
  await requireAdmin();
  await apiPost(`/user/${encodeURIComponent(field(formData, 'userId'))}/deny`, {});
  revalidatePath('/admin/requests');
}
