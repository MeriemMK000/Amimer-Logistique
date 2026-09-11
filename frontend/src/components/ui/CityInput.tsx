'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { suggestPlaces } from '@/lib/api/hooks';
import { communes } from '@/lib/reference/gps';

/** Retire accents / casse pour la recherche. */
const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Repli statique si l'API `/places` ne répond pas.
const FALLBACK = communes.map((c) => ({ c, n: norm(c) }));

/**
 * Champ de saisie de lieu avec **aide à la frappe** : cherche dans le référentiel `places`
 * (1500+ communes d'Algérie, retour DG). Repli sur la liste statique hors ligne.
 */
export default function CityInput({
  value,
  onChange,
  onCommit,
  placeholder,
  autoFocus,
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit?: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [remote, setRemote] = useState<string[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Recherche serveur : communes + rues / quartiers / zones (géocodeur OSM).
  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) { setRemote([]); return; }
    const t = setTimeout(() => {
      suggestPlaces(q).then((hits) => setRemote(hits.map((h) => h.name))).catch(() => setRemote([]));
    }, 300);
    return () => clearTimeout(t);
  }, [value]);

  const matches = useMemo(() => {
    const q = norm(value);
    if (!q) return [];
    if (remote.length) return remote.slice(0, 8);
    const starts = FALLBACK.filter((x) => x.n.startsWith(q));
    const contains = FALLBACK.filter((x) => !x.n.startsWith(q) && x.n.includes(q));
    return [...starts, ...contains].slice(0, 8).map((x) => x.c);
  }, [value, remote]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (city: string) => {
    onChange(city);
    onCommit?.(city);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        style={style}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHi(0); }}
        onFocus={() => value && setOpen(true)}
        onBlur={() => onCommit?.(value)}
        onKeyDown={(e) => {
          if (!open || !matches.length) { if (e.key === 'Enter') onCommit?.(value); return; }
          if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, matches.length - 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          else if (e.key === 'Enter') { e.preventDefault(); pick(matches[hi]); }
          else if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && matches.length > 0 && (
        <ul
          style={{
            position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, zIndex: 50,
            listStyle: 'none', margin: 0, padding: 4, maxHeight: 240, overflowY: 'auto',
            background: 'var(--sc)', border: '1px solid var(--bd)', borderRadius: 'var(--rs)',
            boxShadow: '0 8px 24px rgba(0,0,0,.18)',
          }}
        >
          {matches.map((city, i) => (
            <li
              key={city}
              onMouseDown={(e) => { e.preventDefault(); pick(city); }}
              onMouseEnter={() => setHi(i)}
              style={{
                padding: '6px 10px', fontSize: '.8rem', borderRadius: 6, cursor: 'pointer',
                background: i === hi ? 'var(--b0)' : 'transparent',
                color: i === hi ? 'var(--b6)' : 'var(--tp)',
              }}
            >
              {city}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
