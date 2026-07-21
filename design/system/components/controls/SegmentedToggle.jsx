import React from 'react';

/**
 * SegmentedToggle — compact mono segmented control (e.g. Scripted | Sight).
 * Options are strings or {value,label}. Controlled via value/onChange.
 */
export function SegmentedToggle({ options = [], value, onChange }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--r-chip)',
        overflow: 'hidden',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--fs-label)',
      }}
    >
      {options.map((opt) => {
        const v = typeof opt === 'string' ? opt : opt.value;
        const label = typeof opt === 'string' ? opt : opt.label;
        const active = v === value;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange && onChange(v)}
            style={{
              padding: '5px 11px',
              border: 'none',
              cursor: 'pointer',
              background: active ? 'var(--surface-accent)' : 'transparent',
              color: active ? 'var(--text-2)' : 'var(--text-5)',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
