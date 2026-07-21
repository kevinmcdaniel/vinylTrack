import React from 'react';

const RAMP = ['var(--diff-1)', 'var(--diff-2)', 'var(--diff-3)', 'var(--diff-4)', 'var(--diff-5)'];

/**
 * DifficultyPips — the product's core 1–5 difficulty signal.
 * Fills `level` pips along the shared green→red ramp; the rest read empty.
 * Theme-agnostic: the ramp is identical in light and dark.
 */
export function DifficultyPips({ level = 0, max = 5, width = 4, height = 13 }) {
  const lit = Math.max(0, Math.min(max, Math.round(level)));
  return (
    <span style={{ display: 'inline-flex', gap: 'var(--pip-gap)', alignItems: 'flex-end' }}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          style={{
            width,
            height,
            borderRadius: 'var(--pip-radius)',
            background: i < lit ? RAMP[Math.min(i, RAMP.length - 1)] : 'var(--pip-empty)',
          }}
        />
      ))}
    </span>
  );
}
