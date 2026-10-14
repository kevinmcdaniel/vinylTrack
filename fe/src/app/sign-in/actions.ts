'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AuthError } from 'next-auth';
import { signIn, TURNSTILE_COOKIE } from '@/auth';
import { getConfig } from '@/lib/config';
import { MagicLinkError } from '@/lib/magicLink';

const field = (formData: FormData, name: string) => {
  const v = formData.get(name);
  return typeof v === 'string' ? v : '';
};

// Google: the bot-check token can't ride along through Google's redirect, so
// it waits in a short-lived httpOnly cookie that the signIn callback reads and
// clears (src/auth.ts). Tokens live 300 s; so does the cookie.
export async function signInWithGoogle(formData: FormData) {
  (await cookies()).set(TURNSTILE_COOKIE, field(formData, 'turnstileToken'), {
    httpOnly: true,
    sameSite: 'lax',
    secure: getConfig().appEnv === 'production',
    maxAge: 300,
    path: '/',
  });
  await signIn('google', { redirectTo: '/' });
}

// Development/test only: the provider isn't registered in production.
export async function signInWithDev(formData: FormData) {
  try {
    await signIn('dev', { email: field(formData, 'email'), turnstileToken: field(formData, 'turnstileToken'), redirectTo: '/' });
  } catch (error) {
    // A refused sign-in comes back as an AuthError; anything else (including
    // Next's redirect) must propagate.
    if (error instanceof AuthError) redirect(`/sign-in?error=${encodeURIComponent(error.type)}`);
    throw error;
  }
}

// Magic link (#74): the Turnstile token goes in with the form fields, which
// Auth.js hands to sendVerificationRequest (lib/magicLink.ts). Success lands
// on /sign-in/check-email; a send that didn't happen says why.
export async function signInWithEmail(formData: FormData) {
  try {
    await signIn('email', { email: field(formData, 'email'), turnstileToken: field(formData, 'turnstileToken'), redirectTo: '/' });
  } catch (error) {
    if (error instanceof MagicLinkError) redirect(`/sign-in?error=email-${error.reason}`);
    throw error;
  }
}
