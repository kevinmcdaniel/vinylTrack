import fs from 'fs';
import { notFound } from 'next/navigation';
import DocViewer from '../DocViewer';
import { resolveDocFile } from '../docsFs';
import { requireAdmin } from '@/lib/session';

// Rendered per request so the admin check runs: docs/ holds the hosting
// runbooks, so it is admin-only (#90). Users get /help.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug?: string[] }> };

export default async function DocPage({ params }: Props) {
  await requireAdmin('/help');
  const { slug = [] } = await params;
  const filePath = resolveDocFile(slug);
  if (!filePath) notFound();

  const content = fs.readFileSync(filePath, 'utf-8');
  return <DocViewer content={content} />;
}
