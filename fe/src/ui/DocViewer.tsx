'use client';

import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AnchorHTMLAttributes } from 'react';

/**
 * Resolves a markdown-relative link (e.g. "architecture.md", "README.md") to a
 * route under `basePath` (/docs or /help), so a link stays in its own doc set.
 */
function resolveDocHref(basePath: string, href: string): string {
  const [pathPart, hash] = href.split('#');
  const slug = pathPart.replace(/\.md$/, '');
  const route = slug === 'README' || slug === '' ? basePath : `${basePath}/${slug}`;
  return hash ? `${route}#${hash}` : route;
}

const isRelativeMdLink = (href: string) =>
  !/^(https?:)?\/\//.test(href) && !href.startsWith('/') && !href.startsWith('#');

export default function DocViewer({ content, basePath }: { content: string; basePath: string }) {
  return (
    <article className="prose prose-slate max-w-3xl dark:prose-invert">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => {
            if (!href || !isRelativeMdLink(href)) {
              return (
                <a href={href} {...props}>
                  {children}
                </a>
              );
            }
            return <Link href={resolveDocHref(basePath, href)}>{children}</Link>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
