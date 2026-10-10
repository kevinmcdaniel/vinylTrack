import Turnstile from './Turnstile';
import type { CurrentUser } from '@/lib/session';

type Action = (formData: FormData) => Promise<void>;

/** What a signed-in but not-yet-approved (or declined) user sees (#73). */
export default function PendingView({
  user, siteKey, requestAccessAction, signOutAction,
}: { user: Pick<CurrentUser, 'email' | 'status'> & Partial<CurrentUser>; siteKey: string; requestAccessAction: Action; signOutAction: Action }) {
  const denied = user.status === 'denied';
  return (
    <div className="flex w-full max-w-sm flex-col gap-4 text-center">
      <h1 className="text-xl font-semibold">{denied ? 'Your request was declined' : 'Waiting for approval'}</h1>
      <p className="text-sm opacity-70">
        {denied
          ? `Access for ${user.email} wasn't approved. You can ask again.`
          : `You're signed in as ${user.email}. A family admin needs to approve you before you can see the collections.`}
      </p>
      {denied && (
        <form action={requestAccessAction} className="flex flex-col items-center gap-3">
          <Turnstile siteKey={siteKey} action="request-access" />
          <button type="submit" className="rounded-md bg-[var(--foreground)] px-4 py-2 text-sm font-medium text-[var(--background)]">Ask again</button>
        </form>
      )}
      <form action={signOutAction}>
        <button type="submit" className="text-sm underline">Sign out</button>
      </form>
    </div>
  );
}
