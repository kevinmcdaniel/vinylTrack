import React from 'react';

/**
 * GetOutCard — the high-contrast "how to end the square" callout.
 * Navy on light, warm gold-trimmed on dark (both via --get-out-* tokens).
 */
export function GetOutCard({ label = 'GET-OUT', name, note, from }) {
  return (
    <div
      style={{
        background: 'var(--get-out-bg)',
        border: '1px solid var(--get-out-border)',
        borderRadius: 'var(--r-card)',
        padding: '16px 18px',
      }}
    >
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-label)', letterSpacing: '2px', color: 'var(--get-out-accent)', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'var(--fs-call-lg)', color: 'var(--text-on-inverse)' }}>
        {name}
      </div>
      {note && <div style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--fs-meta)', color: 'rgba(255,255,255,0.62)', marginTop: 5 }}>{note}</div>}
      {from && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-label)', color: 'rgba(255,255,255,0.45)', marginTop: 7 }}>{from}</div>}
    </div>
  );
}
