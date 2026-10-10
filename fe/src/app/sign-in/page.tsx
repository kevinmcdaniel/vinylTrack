import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getConfig } from '@/lib/config';
import { turnstileSiteKey } from '@/lib/turnstileKey';
import SignInForms from '@/ui/SignInForms';
import { signInWithDev, signInWithGoogle } from './actions';

export const dynamic = 'force-dynamic';

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await auth();
  if (session?.user?.id) redirect('/');
  const { error } = await searchParams;
  const config = getConfig();
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold">vinylTrack</h1>
      <SignInForms
        siteKey={turnstileSiteKey(await headers())}
        google={Boolean(config.google)}
        dev={config.devSignIn}
        error={typeof error === 'string' ? error : undefined}
        googleAction={signInWithGoogle}
        devAction={signInWithDev}
      />
    </main>
  );
}
