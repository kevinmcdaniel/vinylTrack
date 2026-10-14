'use client';

import { useState } from 'react';
import Turnstile from './Turnstile';

type Action = (formData: FormData) => Promise<void>;

// ?error= is user-controlled, so it only ever picks one of these.
const ERRORS: Record<string, string> = {
  // 429 covers one address's limit and the mailer's overall cap alike.
  'email-rate-limited': 'Too many sign-in emails right now. Please try again in 15 minutes.',
  'email-failed': 'We couldn\u2019t send the sign-in email. Please try again.',
  Verification: 'That sign-in link has expired or was already used. Ask for a new one below.',
};

const buttonClass = 'w-full rounded-md bg-text px-4 py-2 text-sm font-medium text-bg disabled:opacity-50';

/**
 * The sign-in page body (#73, #74): Google, an emailed link, and in
 * development/test the dev sign-in. One bot check serves every form: its token
 * is copied into each form's `turnstileToken` field. Tokens are single use, and
 * a failed send redirects back here without remounting this component, so
 * every submit clears the token and replaces the widget for the next try.
 */
export default function SignInForms({
  siteKey, google, dev, error, googleAction, devAction, emailAction,
}: { siteKey: string; google: boolean; dev: boolean; error?: string; googleAction: Action; devAction: Action; emailAction: Action }) {
  const [token, setToken] = useState('');
  const [widgetRound, setWidgetRound] = useState(0);
  const tokenField = <input type="hidden" name="turnstileToken" value={token} />;
  // The form's data (token included) is captured before this runs.
  const spending = (act: Action): Action => async (formData) => {
    setToken('');
    setWidgetRound((n) => n + 1);
    await act(formData);
  };
  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      {error && (
        <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm">
          {Object.hasOwn(ERRORS, error) ? ERRORS[error] : 'We couldn\u2019t sign you in. Please try again.'}
        </p>
      )}
      <Turnstile siteKey={siteKey} action="sign-in" onToken={setToken} resetKey={widgetRound} />
      {google && (
        <form action={spending(googleAction)} className="flex flex-col gap-3">
          {tokenField}
          <button type="submit" disabled={!token} className={buttonClass}>Sign in with Google</button>
        </form>
      )}
      <form action={spending(emailAction)} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Email address
          <input name="email" type="email" autoComplete="email" required className="rounded border border-black/20 bg-transparent px-2 py-1 dark:border-white/25" />
        </label>
        {tokenField}
        <button type="submit" disabled={!token} className={buttonClass}>Email me a sign-in link</button>
      </form>
      {dev && (
        <form action={spending(devAction)} className="flex flex-col gap-3 rounded-md border border-dashed border-black/20 p-4 dark:border-white/25">
          <p className="text-xs opacity-70">Development only: sign in as a seeded user.</p>
          <label className="flex flex-col gap-1 text-sm">
            Email
            <input name="email" type="email" defaultValue="kevin@example.com" required className="rounded border border-black/20 bg-transparent px-2 py-1 dark:border-white/25" />
          </label>
          {tokenField}
          <button type="submit" disabled={!token} className={buttonClass}>Dev sign-in</button>
        </form>
      )}
    </div>
  );
}
