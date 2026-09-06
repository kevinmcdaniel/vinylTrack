import { redirect } from 'next/navigation';
import Link from 'next/link';
import { apiGet } from '@/lib/api';
import type { Collection } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Open straight into something useful rather than a landing page. */
export default async function Home() {
  const collections = await apiGet<Collection[]>('/collection');
  if (collections.length > 0) redirect(`/collection/${collections[0]!.id}`);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-2xl font-semibold">vinylTrack</h1>
      <p className="text-sm opacity-70">No collections are shared with you yet.</p>
      <Link href="/docs" className="mt-2 text-sm text-blue-600 underline">
        Read the docs
      </Link>
    </main>
  );
}
