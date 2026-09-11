'use client';

import { useMemo, useState } from 'react';

const COMBINING = /[\u0300-\u036f]/g;

/** Retire les accents et met en minuscule pour une recherche tolérante. */
function norm(s: unknown): string {
  return String(s ?? '').normalize('NFD').replace(COMBINING, '').toLowerCase();
}

/**
 * Filtre texte réutilisable pour toutes les listes longues (demande DG : « là où il y a
 * beaucoup d'enregistrements on doit toujours pouvoir filtrer et rechercher »).
 *
 * `fields` : soit des clés de l'objet, soit une fonction qui renvoie le texte indexable.
 */
export function useSearch<T>(
  items: T[],
  fields: (keyof T)[] | ((item: T) => unknown),
): { q: string; setQ: (v: string) => void; filtered: T[]; count: number; total: number } {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const needle = norm(q).trim();
    if (!needle) return items;
    const parts = needle.split(/\s+/);
    const text = (it: T) =>
      typeof fields === 'function' ? norm(fields(it)) : fields.map((k) => norm(it[k])).join(' ');
    return items.filter((it) => {
      const hay = text(it);
      return parts.every((p) => hay.includes(p));
    });
  }, [items, q, fields]);
  return { q, setQ, filtered, count: filtered.length, total: items.length };
}
