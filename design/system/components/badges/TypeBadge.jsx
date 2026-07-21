import React from 'react';

const KINDS = ['call', 'activator', 'filler', 'tip', 'warning', 'recovery'];

/**
 * TypeBadge — the parser's line classification, shown at the head of a step row.
 * `call` is a choreo step; the other five are presentation text types.
 */
export function TypeBadge({ kind = 'call' }) {
  const k = KINDS.includes(kind) ? kind : 'filler';
  return (
    <span
      style={{
        display: 'inline-block',
        flex: 'none',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--fs-label)',
        fontWeight: 600,
        letterSpacing: '1px',
        textTransform: 'uppercase',
        borderRadius: 'var(--r-tag)',
        padding: '4px 8px',
        color: `var(--badge-${k}-fg)`,
        background: `var(--badge-${k}-bg)`,
      }}
    >
      {k}
    </span>
  );
}
