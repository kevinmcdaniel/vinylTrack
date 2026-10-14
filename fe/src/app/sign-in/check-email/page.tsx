import Link from 'next/link';

// Auth.js's verifyRequest page (#74): the link is on its way. Says nothing
// about whether the address has an account.
export default function CheckEmailPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">Check your email</h1>
      <p className="text-sm opacity-80">
        We sent you a sign-in link. It works once, for 15 minutes. If it doesn&apos;t arrive, check your spam folder.
      </p>
      <Link href="/sign-in" className="text-sm underline">Back to sign in</Link>
    </main>
  );
}
