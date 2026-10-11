import { requireActiveUser } from '@/lib/session';
import NewCollectionForm from '@/ui/NewCollectionForm';
import { createCollection } from './actions';

export const dynamic = 'force-dynamic';

export default async function NewCollectionPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireActiveUser();
  const { error } = await searchParams;
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">New collection</h1>
      <NewCollectionForm action={createCollection} error={typeof error === 'string' ? error : undefined} />
    </section>
  );
}
