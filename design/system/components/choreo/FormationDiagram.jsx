import React from 'react';

/**
 * FormationDiagram — abstract dancer layout: squares (boys) and circles (girls),
 * facing arrows (up/down) and amber hand-link bars between adjacent dancers.
 * `rows` is an array of rows; each dancer is { shape, dir, link }.
 */
export function FormationDiagram({ rows = [], size = 34 }) {
  const arrowBase = { position: 'absolute', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }}>
      {rows.map((row, ri) => (
        <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {row.map((d, di) => (
            <React.Fragment key={di}>
              <div style={{ position: 'relative', width: size, height: size }}>
                {d.dir === 'up' && <span style={{ ...arrowBase, top: -11, borderBottom: '9px solid var(--facing)' }} />}
                {d.dir === 'down' && <span style={{ ...arrowBase, bottom: -11, borderTop: '9px solid var(--facing)' }} />}
                <span
                  style={{
                    display: 'block',
                    width: size,
                    height: size,
                    borderRadius: d.shape === 'girl' ? '50%' : '4px',
                    background: 'var(--surface-accent)',
                    border: '1.5px solid var(--facing)',
                  }}
                />
              </div>
              {d.link && <span style={{ width: 14, height: 4, borderRadius: 2, background: 'var(--hand-link)' }} />}
            </React.Fragment>
          ))}
        </div>
      ))}
    </div>
  );
}
