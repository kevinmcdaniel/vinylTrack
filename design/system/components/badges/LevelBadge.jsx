import React from 'react';

/**
 * LevelBadge — the program/level tag (MS, PLUS, A-1, A-2, C-1…).
 * Outlined mono pill; inherits the theme accent (blue light / pastel-green dark).
 */
export function LevelBadge({ level = 'PLUS' }) {
  return (
    <span
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--fs-label)',
        letterSpacing: '1.5px',
        textTransform: 'uppercase',
        color: 'var(--accent)',
        border: '1px solid var(--accent)',
        borderRadius: 'var(--r-tag)',
        padding: '3px 8px',
      }}
    >
      {level}
    </span>
  );
}
