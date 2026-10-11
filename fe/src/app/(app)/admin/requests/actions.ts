'use server';

import { redirect } from 'next/navigation';
import { apiPost, ApiError } from '@/lib/api';
import { requireAdmin } from '@/lib/session';

const field = (formData: FormData, name: string) => {
  const v = formData.get(name);
  return typeof v === 'string' ? v : '';
};

// Redirect either way: it re-renders the list and clears any earlier ?error=.
// 409 (owner already linked) and 404 (user gone) are expected races between
// admins, so they become a message rather than an error page.
async function decide(path: string, body: Record<string, string>) {
  try {
    await apiPost(path, body);
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) redirect('/admin/requests?error=conflict');
    if (error instanceof ApiError && error.status === 404) redirect('/admin/requests?error=gone');
    throw error;
  }
  redirect('/admin/requests');
}

export async function approveRequest(formData: FormData) {
  await requireAdmin();
  const ownerId = field(formData, 'ownerId');
  await decide(`/user/${encodeURIComponent(field(formData, 'userId'))}/approve`, ownerId ? { ownerId } : {});
}

export async function denyRequest(formData: FormData) {
  await requireAdmin();
  await decide(`/user/${encodeURIComponent(field(formData, 'userId'))}/deny`, {});
}
