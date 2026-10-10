'use server';

import { redirect } from 'next/navigation';
import { apiPost, ApiError } from '@/lib/api';

export async function createCollection(formData: FormData) {
  const get = (n: string) => (typeof formData.get(n) === 'string' ? (formData.get(n) as string) : '');
  let id: string;
  try {
    const notes = get('notes').trim();
    const created = await apiPost<{ id: string }>('/collection', { name: get('name'), kind: get('kind'), ...(notes ? { notes } : {}) });
    id = created.id;
  } catch (error) {
    if (error instanceof ApiError && error.status === 406) redirect(`/collection/new?error=${encodeURIComponent(error.message)}`);
    throw error;
  }
  redirect(`/collection/${id}`);
}
