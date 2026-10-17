/**
 * The alert above a write form (#102). `code` comes from `?error=`, which is
 * user-controlled, so it only ever selects one of `messages`: an unknown code
 * gets the generic line and is never rendered itself.
 */
export default function FormError({ code, messages }: { code?: string; messages: Partial<Record<string, string>> }) {
  if (!code) return null;
  const message = Object.hasOwn(messages, code) ? messages[code] : undefined;
  return (
    <p role="alert" className="rounded-md bg-danger-bg p-3 text-sm text-danger-text">
      {message ?? 'Something went wrong. Please try again.'}
    </p>
  );
}
