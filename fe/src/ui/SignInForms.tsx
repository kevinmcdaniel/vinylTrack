import Turnstile from './Turnstile';

type Action = (formData: FormData) => Promise<void>;

// ?error= is user-controlled, so it only ever picks one of these.
const ERRORS: Record<string, string> = {
  'email-rate-limited': 'Too many sign-in emails to that address. Please try again in 15 minutes.',
  'email-failed': 'We couldn\u2019t send the sign-in email. Please try again.',
  Verification: 'That sign-in link has expired or was already used. Ask for a new one below.',
};

const buttonClass = 'w-full rounded-md bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)]';

/** The sign-in page body (#73, #74): Google, an emailed link, and in development/test the dev sign-in. */
export default function SignInForms({
  siteKey, google, dev, error, googleAction, devAction, emailAction,
}: { siteKey: string; google: boolean; dev: boolean; error?: string; googleAction: Action; devAction: Action; emailAction: Action }) {
  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      {error && (
        <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm">
          {Object.hasOwn(ERRORS, error) ? ERRORS[error] : 'We couldn\u2019t sign you in. Please try again.'}
        </p>
      )}
      {google && (
        <form action={googleAction} className="flex flex-col gap-3">
          <Turnstile siteKey={siteKey} action="sign-in" />
          <button type="submit" className={buttonClass}>Sign in with Google</button>
        </form>
      )}
      <form action={emailAction} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Email address
          <input name="email" type="email" autoComplete="email" required className="rounded border border-black/20 bg-transparent px-2 py-1 dark:border-white/25" />
        </label>
        <Turnstile siteKey={siteKey} action="magic-link" />
        <button type="submit" className={buttonClass}>Email me a sign-in link</button>
      </form>
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
