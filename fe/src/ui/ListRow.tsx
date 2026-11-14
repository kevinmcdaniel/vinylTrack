import type { ReactNode } from 'react';

/**
 * One line of a list (#137): the main text (a name, often a link) truncates on
 * the left, then optional muted meta, then the trailing action. The action
 * never shrinks, so a long name can't push it onto a second line at 390px.
 * `filterText` is what `RowFilter` matches against.
 */
export default function ListRow({ children, meta, action, filterText }: {
  children: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  filterText: string;
}) {
  return (
    <li data-filter={filterText.toLowerCase()} className="flex items-center gap-3 px-3 py-2">
      <span className="min-w-0 flex-1 truncate text-sm text-text">{children}</span>
      {meta && <span className="shrink-0 text-xs text-text-muted">{meta}</span>}
      {action && <span className="shrink-0 text-sm">{action}</span>}
    </li>
  );
}
