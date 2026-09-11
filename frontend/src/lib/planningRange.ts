'use client';

import { useMemo, useState } from 'react';

export type PlanningView = 'day' | 'week' | 'month';

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const DOW = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
/** Lundi de la semaine contenant d. */
const monday = (d: Date) => { const x = new Date(d); const dow = (x.getDay() + 6) % 7; return addDays(x, -dow); };

export interface PlanningRange {
  view: PlanningView;
  setView: (v: PlanningView) => void;
  anchor: Date;
  days: { iso: string; d: number; dow: string; weekend: boolean }[];
  label: string;
  prev: () => void;
  next: () => void;
  goToday: () => void;
}

/** Navigation planning : jour / semaine / mois avec flèches (retour DG). */
export function usePlanningRange(initialView: PlanningView = 'week'): PlanningRange {
  const [view, setView] = useState<PlanningView>(initialView);
  const [anchor, setAnchor] = useState(() => { const x = new Date(); x.setHours(0, 0, 0, 0); return x; });

  const days = useMemo(() => {
    let list: Date[];
    if (view === 'day') list = [anchor];
    else if (view === 'week') list = Array.from({ length: 7 }, (_, i) => addDays(monday(anchor), i));
    else {
      const y = anchor.getFullYear(); const m = anchor.getMonth();
      const last = new Date(y, m + 1, 0).getDate();
      list = Array.from({ length: last }, (_, i) => new Date(y, m, i + 1));
    }
    return list.map((d) => ({ iso: iso(d), d: d.getDate(), dow: DOW[d.getDay()], weekend: d.getDay() === 5 || d.getDay() === 6 }));
  }, [view, anchor]);

  const label = useMemo(() => {
    if (view === 'day') return `${DOW[anchor.getDay()]} ${anchor.getDate()} ${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`;
    if (view === 'month') return `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`;
    const mon = monday(anchor); const sun = addDays(mon, 6);
    return `Semaine du ${mon.getDate()} ${MONTHS[mon.getMonth()]} au ${sun.getDate()} ${MONTHS[sun.getMonth()]} ${sun.getFullYear()}`;
  }, [view, anchor]);

  const step = (dir: number) => setAnchor((a) => {
    if (view === 'day') return addDays(a, dir);
    if (view === 'week') return addDays(a, dir * 7);
    const x = new Date(a); x.setMonth(x.getMonth() + dir); return x;
  });

  return {
    view, setView, anchor, days, label,
    prev: () => step(-1), next: () => step(1),
    goToday: () => { const x = new Date(); x.setHours(0, 0, 0, 0); setAnchor(x); },
  };
}
