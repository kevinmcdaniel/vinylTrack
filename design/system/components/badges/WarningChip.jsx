import React from 'react';

/**
 * WarningChip — surfaces the two warning levels distinctly.
 * `inherent` lives on the call itself (true wherever it appears) → amber.
 * `contextual` lives on this spot in this routine → danger/rose.
 */
export function WarningChip({ level = 'inherent', text }) {
  const inherent = level === 'inherent';
  return (
    <span
      title={`${inherent ? 'Inherent' : 'Contextual'} warning`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        border: `1px solid ${inherent ? 'var(--warn-strong)' : 'var(--danger-line)'}`,
        background: inherent ? 'var(--warn-soft)' : 'var(--danger-soft)',
        color: inherent ? 'var(--warn)' : 'var(--danger)',
        borderRadius: 'var(--r-tag)',
        padding: '3px 8px',
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--fs-meta)',
      }}
    >
      <span aria-hidden>▲</span>
      <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{level}:</span>
      <span>{text}</span>
    </span>
  );
}
