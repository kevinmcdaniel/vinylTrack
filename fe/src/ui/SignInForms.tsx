import Turnstile from './Turnstile';

type Action = (formData: FormData) => Promise<void>;

const buttonClass = 'w-full rounded-md bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)]';

/** The sign-in page body (#73): Google, and in development/test the dev sign-in. */
export default function SignInForms({
  siteKey, google, dev, error, googleAction, devAction,
}: { siteKey: string; google: boolean; dev: boolean; error?: string; googleAction: Action; devAction: Action }) {
  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      {error && (
        <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm">
          We couldn&apos;t sign you in. Please try again.
        </p>
      )}
      {google && (
        <form action={googleAction} className="flex flex-col gap-3">
          <Turnstile siteKey={siteKey} action="sign-in" />
          <button type="submit" className={buttonClass}>Sign in with Google</button>
        </form>
      )}
      {dev && (
        <form action={devAction} className="flex flex-col gap-3 rounded-md border border-dashed border-black/20 p-4 dark:border-white/25">
          <p className="text-xs opacity-70">Development only: sign in as a seeded user.</p>
          <label className="flex flex-col gap-1 text-sm">
            Email
            <input name="email" type="email" defaultValue="kevin@example.com" required className="rounded border border-black/20 bg-transparent px-2 py-1 dark:border-white/25" />
          </label>
          <Turnstile siteKey={siteKey} action="sign-in" />
          <button type="submit" className={buttonClass}>Dev sign-in</button>
        </form>
      )}
    </div>
  );
}
