import { requireActiveUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * User help (#90). Placeholder until docs/user/ and its viewer land; exists
 * now because /docs sends approved non-admins here.
 */
export default async function HelpPage() {
  await requireActiveUser();
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-lg font-semibold">Help</h1>
      <p className="text-sm opacity-70">Help pages are on the way.</p>
    </section>
  );
}
