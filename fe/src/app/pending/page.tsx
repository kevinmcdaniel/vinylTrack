import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { turnstileSiteKey } from '@/lib/turnstileKey';
import PendingView from '@/ui/PendingView';
import { requestAccessAgain, signOutAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function PendingPage() {
  const user = await getCurrentUser();
  if (user.status === 'active') redirect('/');
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center p-8">
      <PendingView user={user} siteKey={turnstileSiteKey(await headers())} requestAccessAction={requestAccessAgain} signOutAction={signOutAction} />
    </main>
  );
}
