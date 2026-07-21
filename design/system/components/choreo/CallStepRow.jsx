import React from 'react';
import { DesignatorPill } from '../badges/DesignatorPill.jsx';
import { DifficultyPips } from '../badges/DifficultyPips.jsx';
import { WarningChip } from '../badges/WarningChip.jsx';

/**
 * CallStepRow — the sequence editor's two-column step: SPOKEN (what you call:
 * designator + call + count) alongside CHOREO (what happens: formation in→out,
 * difficulty, hands, beats, technique). Left border + tint reflect resolution.
 */
export function CallStepRow({
  index,
  designator,
  name,
  count,
  resolution = 'resolved',
  formationIn,
  formationOut,
  difficulty = 0,
  hands,
  beats,
  tech,
  warning,
}) {
  const line =
    resolution === 'unresolved' ? 'var(--res-unresolved-line)'
    : resolution === 'ambiguous' ? 'var(--res-ambiguous-line)'
    : 'transparent';
  const tint =
    resolution === 'unresolved' ? 'var(--res-unresolved-bg)'
    : resolution === 'ambiguous' ? 'var(--res-ambiguous-bg)'
    : 'transparent';
  const cell = { padding: '11px 16px', borderLeft: '1px solid var(--row-divider)' };
  const code = {
    fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-label)',
    borderRadius: 'var(--r-tag)', padding: '2px 7px',
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '40px 1fr 1fr',
        borderBottom: '1px solid var(--row-divider)',
        borderLeft: `3px solid ${line}`,
        background: tint,
        fontFamily: 'var(--font-body)',
      }}
    >
      <div style={{ padding: '13px 8px', fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-meta)', color: 'var(--text-6)' }}>
        {index}
      </div>

      {/* SPOKEN */}
      <div style={{ ...cell, display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <DesignatorPill text={designator} tone="editor" />
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-call-md)', color: 'var(--text-2)' }}>
          {name}
        </span>
        {count != null && count !== '' && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-lg)', color: 'var(--text-4)' }}>×{count}</span>
        )}
        {warning && <WarningChip level={warning.level || 'inherent'} text={warning.text} />}
      </div>

      {/* CHOREO */}
      <div style={{ ...cell, display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ ...code, color: 'var(--text-4)', background: 'var(--surface-accent-2)' }}>{formationIn}</span>
          <span style={{ color: 'var(--text-6)', fontSize: 'var(--fs-meta)' }}>→</span>
          <span style={{ ...code, color: 'var(--text-2)', background: 'var(--surface-accent)' }}>{formationOut}</span>
          <span style={{ marginLeft: 2 }}><DifficultyPips level={difficulty} height={12} /></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-label)', color: 'var(--text-5)' }}>
          {hands && <span>hands · {hands}</span>}
          {beats != null && <span>{beats} beats</span>}
        </div>
        {tech && <div style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--fs-meta)', color: 'var(--text-4)' }}>{tech}</div>}
      </div>
    </div>
  );
}
