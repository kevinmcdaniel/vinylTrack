import React from 'react';

const SIZES = {
  sm: { padding: '5px 11px', fontSize: 'var(--fs-meta)' },
  md: { padding: '8px 14px', fontSize: 'var(--fs-sm)' },
  lg: { padding: '10px 20px', fontSize: 'var(--fs-body)' },
};

function look(variant, hover) {
  switch (variant) {
    case 'secondary':
      return { background: hover ? 'var(--surface-sunken)' : 'transparent', color: 'var(--text-3)', border: '1px solid var(--border-strong)' };
    case 'ghost':
      return { background: hover ? 'var(--surface-accent)' : 'transparent', color: 'var(--accent)', border: '1px solid transparent' };
    case 'success':
      return { background: hover ? 'var(--accent-press)' : 'var(--success)', color: '#fff', border: '1px solid transparent' };
    case 'primary':
    default:
      return { background: hover ? 'var(--accent-press)' : 'var(--accent)', color: 'var(--text-on-accent)', border: '1px solid transparent' };
  }
}

/**
 * Button — the standard action. primary (accent fill), secondary (outline),
 * ghost (accent text), success (save/activate). Disabled dims and blocks.
 */
export function Button({ children, variant = 'primary', size = 'md', icon, onClick, disabled = false, type = 'button' }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        fontFamily: 'var(--font-body)',
        fontWeight: 600,
        borderRadius: 'var(--r-chip)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'background .12s ease',
        whiteSpace: 'nowrap',
        ...SIZES[size] || SIZES.md,
        ...look(variant, hover && !disabled),
      }}
    >
      {icon && <span aria-hidden style={{ fontSize: '1.05em', lineHeight: 1 }}>{icon}</span>}
      {children}
    </button>
  );
}
