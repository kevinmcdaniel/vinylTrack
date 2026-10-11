import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { turnstileSiteKey } from '@/lib/turnstileKey';
import PendingView from '@/ui/PendingView';
import { requestAccessAgain, signOutAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function PendingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (user.status === 'active') redirect('/');
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center p-8">
      <PendingView user={user} siteKey={turnstileSiteKey(await headers())} error={typeof error === 'string' ? error : undefined} requestAccessAction={requestAccessAgain} signOutAction={signOutAction} />
    </main>
  );
}
