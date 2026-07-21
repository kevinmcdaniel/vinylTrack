import Link from 'next/link';
import { getDocList } from './docsFs';

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const docs = getDocList();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="w-full flex-none border-b border-gray-200 md:w-56 md:border-b-0 md:border-r">
        <div className="px-3 py-4">
          <Link href="/docs" className="mb-4 block px-2 py-2 text-sm font-semibold">
            vinylTrack docs
          </Link>
          <nav className="flex flex-col gap-1">
            {docs.map((doc) => (
              <Link
                key={doc.slug}
                href={`/docs/${doc.slug}`}
                className="rounded-md px-3 py-1.5 text-sm hover:bg-sky-100 hover:text-blue-600"
              >
                {doc.label}
              </Link>
            ))}
          </nav>
        </div>
      </aside>
      <div className="flex-grow p-6 md:overflow-y-auto md:p-10">{children}</div>
    </div>
  );
}
