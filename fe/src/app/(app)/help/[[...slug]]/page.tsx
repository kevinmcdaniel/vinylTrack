import fs from 'fs';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { resolveDocFile, userDocsDir } from '@/lib/docsFs';
import { requireActiveUser } from '@/lib/session';
import DocViewer from '@/ui/DocViewer';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug?: string[] }> };

/**
 * User help (#90): docs/user/, for any approved user. Only that folder is
 * read, so the admin docs one level up never resolve here. No sidebar inside
 * the phone-width app shell: docs/user/README.md links the pages in reading
 * order, and each page links back to it.
 */
export default async function HelpPage({ params }: Props) {
  await requireActiveUser();
  const { slug = [] } = await params;
  const filePath = resolveDocFile(userDocsDir, slug);
  if (!filePath) notFound();

  const content = fs.readFileSync(filePath, 'utf-8');
  return (
    <div className="flex flex-col gap-5">
      {/* Every page, not just subpages: the header title alone was too easy to miss (#124). */}
      <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link href="/" className="text-primary underline">← Back to vinylTrack</Link>
        {slug.length > 0 && <Link href="/help" className="text-primary underline">← Help</Link>}
      </nav>
      <DocViewer content={content} basePath="/help" />
    </div>
  );
}
