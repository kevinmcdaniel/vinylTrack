import { redirect } from 'next/navigation';
import Link from 'next/link';
import { apiGet } from '@/lib/api';
import type { Collection } from '@/lib/types';
import EmptyState from '@/ui/EmptyState';

export const dynamic = 'force-dynamic';

/**
 * Open straight into something useful rather than a landing page. Inside the
 * (app) shell, so even the empty state shows who you're signed in as (#124).
 */
export default async function Home() {
  const collections = await apiGet<Collection[]>('/collection');
  if (collections.length > 0) redirect(`/collection/${collections[0]!.id}`);

  return (
    <section className="flex flex-col gap-4">
      <h1 className="font-display text-lg font-semibold">vinylTrack</h1>
      <EmptyState>
        No collections yet.{' '}
        <Link href="/collection/new" className="text-primary underline">Start a collection</Link>
        , or ask a family member to share theirs.
      </EmptyState>
    </section>
  );
}
