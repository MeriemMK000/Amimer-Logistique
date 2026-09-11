'use client';

import { monthOptions, type Period } from '@/lib/period';

const selStyle: React.CSSProperties = {
  padding: '4px 8px', border: '1px solid var(--bd)', borderRadius: 'var(--rs)',
  fontSize: '.75rem', background: 'var(--s1)', color: 'var(--tp)',
};

/** Sélecteur de période commun aux boxes de reporting (mois courant / mois choisi / cumulé). */
export default function PeriodPicker({ period }: { period: Period }) {
  const opts = monthOptions();
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', border: '1px solid var(--bd)', borderRadius: 'var(--rs)', overflow: 'hidden' }}>
        {(['current', 'month', 'cumul'] as const).map((m) => (
          <button
            key={m}
            className={`btn btn-sm${period.mode === m ? ' btn-p' : ''}`}
            style={{ border: 0, borderRadius: 0, fontSize: '.65rem', padding: '3px 10px' }}
            onClick={() => period.setMode(m)}
          >
            {m === 'current' ? 'Mois courant' : m === 'month' ? 'Mois choisi' : 'Cumulé'}
          </button>
        ))}
      </div>
      {period.mode === 'month' && (
        <select style={selStyle} value={period.month} onChange={(e) => period.setMonth(e.target.value)}>
          {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
      <span style={{ fontSize: '.68rem', color: 'var(--tm)' }}>{period.label}</span>
    </div>
  );
}
