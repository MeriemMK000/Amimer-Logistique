'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { filterList } from '@/lib/reference/carCatalog';

/**
 * Liste déroulante **recherchable** pour les référentiels longs (marques, modèles…).
 * Champ texte + suggestions filtrées (préfixe puis sous-chaîne). Saisie libre autorisée
 * par défaut (`allowFreeText`) : le parc peut contenir une marque/un modèle hors liste.
 */
export default function ComboBox({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  allowFreeText = true,
  emptyHint,
  autoFocus,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  allowFreeText?: boolean;
  /** Message quand la marque n'est pas choisie / aucune option. */
  emptyHint?: string;
  autoFocus?: boolean;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [touched, setTouched] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const matches = useMemo(
    () => filterList(options, touched ? value : '', 60),
    [options, value, touched],
  );

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const hiSafe = Math.max(0, Math.min(hi, matches.length - 1));

  const pick = (v: string) => {
    onChange(v);
    setTouched(false);
    setOpen(false);
  };

  const known = options.some((o) => o.toLowerCase() === value.trim().toLowerCase());
  const showFreeTextNote = allowFreeText && !open && value.trim().length > 0 && !known && options.length > 0;

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          value={value}
          disabled={disabled}
          autoFocus={autoFocus}
          placeholder={placeholder}
          aria-label={ariaLabel}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          style={{ paddingRight: 26 }}
          onChange={(e) => { onChange(e.target.value); setTouched(true); setOpen(true); setHi(0); }}
          onFocus={() => { setTouched(false); setOpen(true); setHi(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi(Math.min(hiSafe + 1, matches.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(Math.max(hiSafe - 1, 0)); }
            else if (e.key === 'Enter' && open && matches[hiSafe]) { e.preventDefault(); pick(matches[hiSafe]); }
            else if (e.key === 'Escape' && open) {
              // Ferme la liste sans laisser l'Échap remonter jusqu'à la modale (qui se fermerait).
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
              setOpen(false);
            }
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={open ? 'Fermer' : 'Ouvrir la liste'}
          disabled={disabled}
          onClick={() => { setTouched(false); setOpen((o) => !o); }}
          style={{
            position: 'absolute', right: 2, width: 22, height: 22, display: 'grid', placeItems: 'center',
            border: 0, background: 'transparent', color: 'var(--tm)', cursor: disabled ? 'default' : 'pointer',
          }}
        >
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2.4}
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {showFreeTextNote && (
        <div style={{ fontSize: '.62rem', color: 'var(--a6)', marginTop: 2 }}>
          Hors liste — sera enregistré tel quel.
        </div>
      )}

      {open && !disabled && (
        <ul
          id={listId}
          role="listbox"
          style={{
            position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, zIndex: 60,
            listStyle: 'none', margin: 0, padding: 4, maxHeight: 220, overflowY: 'auto',
            background: 'var(--sc)', border: '1px solid var(--bd)', borderRadius: 'var(--rs)',
            boxShadow: '0 10px 28px rgba(15,26,46,.20)',
          }}
        >
          {matches.length === 0 && (
            <li style={{ padding: '7px 10px', fontSize: '.72rem', color: 'var(--tm)' }}>
              {options.length === 0 ? (emptyHint ?? 'Aucune option') : 'Aucun résultat'}
            </li>
          )}
          {matches.map((m, i) => (
            <li
              key={m}
              role="option"
              aria-selected={i === hiSafe}
              onMouseDown={(e) => { e.preventDefault(); pick(m); }}
              onMouseEnter={() => setHi(i)}
              style={{
                padding: '6px 10px', fontSize: '.8rem', borderRadius: 5, cursor: 'pointer',
                background: i === hiSafe ? 'var(--b0)' : 'transparent',
                color: i === hiSafe ? 'var(--b6)' : 'var(--tp)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}
            >
              {m}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
