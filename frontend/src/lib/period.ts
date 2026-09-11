'use client';

import { useMemo, useState } from 'react';

export type PeriodMode = 'current' | 'month' | 'cumul';

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

export function monthOptions(count = 12): { value: string; label: string }[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` };
  });
}

/** Normalise une date ("26/08", "26/08/2026", "2026-08-26", Date) en "YYYY-MM". */
export function toYearMonth(v: string | Date | null | undefined, defaultYear = new Date().getFullYear()): string | null {
  if (!v) return null;
  if (v instanceof Date) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}`;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})/); // ISO
  if (m) return `${m[1]}-${m[2]}`;
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/); // DD/MM/YYYY
  if (m) return `${m[3]}-${m[2]}`;
  m = s.match(/^(\d{2})\/(\d{2})$/); // DD/MM
  if (m) return `${defaultYear}-${m[2]}`;
  return null;
}

export interface Period {
  mode: PeriodMode;
  month: string; // YYYY-MM (utilisé si mode !== cumul)
  label: string;
  setMode: (m: PeriodMode) => void;
  setMonth: (m: string) => void;
  /** true si la date appartient à la période (toujours true en cumulé). */
  matches: (date: string | Date | null | undefined) => boolean;
}

export function usePeriod(): Period {
  const opts = useMemo(() => monthOptions(), []);
  const [mode, setMode] = useState<PeriodMode>('current');
  const [month, setMonth] = useState(opts[0].value);

  const effectiveMonth = mode === 'current' ? opts[0].value : month;
  const label =
    mode === 'cumul' ? 'Cumulé (toutes périodes)' : opts.find((o) => o.value === effectiveMonth)?.label ?? effectiveMonth;

  const matches = (date: string | Date | null | undefined) => {
    if (mode === 'cumul') return true;
    return toYearMonth(date) === effectiveMonth;
  };

  return { mode, month: effectiveMonth, label, setMode, setMonth, matches };
}
