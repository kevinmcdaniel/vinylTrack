import fs from 'fs';
import { notFound } from 'next/navigation';
import DocViewer from '../DocViewer';
import { getAllDocSlugs, resolveDocFile } from '../docsFs';

type Props = { params: Promise<{ slug?: string[] }> };

export async function generateStaticParams() {
  return getAllDocSlugs().map((slug) => ({ slug }));
}

export default async function DocPage({ params }: Props) {
  const { slug = [] } = await params;
  const filePath = resolveDocFile(slug);
  if (!filePath) notFound();

  const content = fs.readFileSync(filePath, 'utf-8');
  return <DocViewer content={content} />;
}
