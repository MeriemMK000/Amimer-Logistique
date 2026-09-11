'use client';

import { useRef, useState } from 'react';

/**
 * Saisie de date au format **français jj/mm/aaaa** (retour DG : l'`<input type="date">`
 * natif s'affiche selon la locale de l'OS — mm/dd/yyyy pour beaucoup de postes).
 *
 * - champ texte masqué `jj/mm/aaaa` (chiffres seuls, `/` automatiques) ;
 * - icône calendrier → ouvre le sélecteur natif du navigateur ;
 * - `value` et `onChange` gardent le **contrat de `<input type="date">`** : valeur ISO
 *   `AAAA-MM-JJ`, `onChange({ target: { value } })` — les appelants ne changent pas.
 */
const calIcon = (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2}>
    <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

/** ISO `AAAA-MM-JJ` → `JJ/MM/AAAA` (vide si non ISO). */
function isoToFr(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** `JJ/MM/AAAA` complet et valide → ISO `AAAA-MM-JJ`, sinon `''`. */
function frToIso(fr: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(fr.trim());
  if (!m) return '';
  const [, d, mo, y] = m;
  const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  if (dt.getUTCFullYear() !== Number(y) || dt.getUTCMonth() + 1 !== Number(mo) || dt.getUTCDate() !== Number(d)) return '';
  return `${y}-${mo}-${d}`;
}

/** Ne garde que les chiffres (max 8) et replace les `/` : 2 · 2 · 4. */
function maskFr(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join('/');
}

interface Props {
  value: string | null | undefined;
  /** Même signature que `<input type="date">` : reçoit `{ target: { value } }`, valeur ISO `AAAA-MM-JJ`. */
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  id?: string;
  name?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  'aria-label'?: string;
}

export default function DateInput({
  value, onChange, min, max, required, disabled, readOnly, id, name, style, placeholder, ...aria
}: Props) {
  const iso = /^\d{4}-\d{2}-\d{2}/.test(String(value ?? '')) ? String(value).slice(0, 10) : '';
  const [text, setText] = useState(() => isoToFr(iso));
  const [synced, setSynced] = useState(iso);
  // Re-synchronise si la valeur change côté parent (reset formulaire, préremplissage…).
  if (iso !== synced) { setSynced(iso); setText(isoToFr(iso)); }

  const nativeRef = useRef<HTMLInputElement>(null);

  const emit = (v: string) =>
    onChange({ target: { value: v } } as unknown as React.ChangeEvent<HTMLInputElement>);

  const onText = (raw: string) => {
    const t = maskFr(raw);
    setText(t);
    if (!t) emit('');
    else {
      const next = frToIso(t);
      if (next) emit(next);            // date complète et valide
      else if (iso) emit('');          // saisie en cours / invalide → on efface la valeur ISO
    }
  };

  const openPicker = () => {
    const el = nativeRef.current;
    if (!el) return;
    try { (el as HTMLInputElement & { showPicker?: () => void }).showPicker?.(); }
    catch { el.focus(); }
  };

  return (
    <div style={{ position: 'relative', display: 'block' }}>
      <input
        {...aria}
        id={id}
        name={name}
        value={text}
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder ?? 'jj/mm/aaaa'}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        aria-invalid={required && !!text && !frToIso(text) ? true : undefined}
        style={{ width: '100%', ...style, paddingRight: 30 }}
        onChange={(e) => onText(e.target.value)}
        onPaste={(e) => { e.preventDefault(); onText(e.clipboardData.getData('text')); }}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Ouvrir le calendrier"
        disabled={disabled || readOnly}
        onClick={openPicker}
        style={{
          position: 'absolute', right: 6, top: 0, bottom: 0, display: 'grid', placeItems: 'center',
          border: 0, background: 'transparent', color: 'var(--tm)', padding: 0,
          cursor: disabled || readOnly ? 'default' : 'pointer',
        }}
      >
        {calIcon}
      </button>
      {/* Sélecteur natif — invisible, ancré sous l'icône ; sa seule fonction est le calendrier. */}
      <input
        ref={nativeRef}
        type="date"
        tabIndex={-1}
        aria-hidden
        value={iso}
        min={min}
        max={max}
        disabled={disabled || readOnly}
        onChange={(e) => { setText(isoToFr(e.target.value)); emit(e.target.value); }}
        style={{ position: 'absolute', right: 4, width: 20, height: '100%', opacity: 0, border: 0, padding: 0, pointerEvents: 'none' }}
      />
    </div>
  );
}
