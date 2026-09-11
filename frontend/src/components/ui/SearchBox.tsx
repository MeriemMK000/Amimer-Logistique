'use client';

/** Champ de recherche standard pour les listes longues (demande DG). */
export default function SearchBox({
  value, onChange, placeholder = 'Rechercher…', count, total, style,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  count?: number;
  total?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...style }}>
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
        <span style={{ position: 'absolute', left: 8, color: 'var(--tm)', fontSize: '.8rem', pointerEvents: 'none' }}></span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            padding: '5px 26px 5px 24px', border: '1px solid var(--bd)', borderRadius: 'var(--rs)',
            fontSize: '.78rem', background: 'var(--s1)', color: 'var(--tp)', minWidth: 200,
          }}
        />
        {value && (
          <button
            onClick={() => onChange('')}
            title="Effacer"
            style={{ position: 'absolute', right: 4, border: 0, background: 'transparent', color: 'var(--tm)', cursor: 'pointer', fontSize: '.9rem', lineHeight: 1 }}
          >
            ×
          </button>
        )}
      </div>
      {value && count != null && total != null && (
        <span style={{ fontSize: '.68rem', color: 'var(--tm)' }}>{count} / {total}</span>
      )}
    </div>
  );
}
