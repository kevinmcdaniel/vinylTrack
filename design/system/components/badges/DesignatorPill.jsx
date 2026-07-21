import React from 'react';

/**
 * DesignatorPill — who acts on a call (Heads, Sides, Boys, Centers, Leads…).
 * `tone="editor"` = mono uppercase terracotta pill for the editor's spoken column.
 * `tone="inline"` = muted display prefix that reads back inside a live call line.
 */
export function DesignatorPill({ text, tone = 'editor' }) {
  if (!text) return null;
  if (tone === 'inline') {
    return (
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, color: 'var(--designator)' }}>
        {text}{' '}
      </span>
    );
  }
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--fs-sm)',
        fontWeight: 600,
        textTransform: 'uppercase',
        color: 'var(--designator)',
        letterSpacing: '0.5px',
      }}
    >
      {text}
    </span>
  );
}
