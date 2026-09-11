'use client';

import type { PlanningRange, PlanningView } from '@/lib/planningRange';

const VIEWS: { v: PlanningView; l: string }[] = [
  { v: 'day', l: 'Jour' }, { v: 'week', l: 'Semaine' }, { v: 'month', l: 'Mois' },
];

/** Barre de navigation planning : ◀ [Jour|Semaine|Mois] libellé ▶ Aujourd'hui. */
export default function PlanningNav({ range }: { range: PlanningRange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
      <div style={{ display: 'flex', border: '1px solid var(--bd)', borderRadius: 'var(--rs)', overflow: 'hidden' }}>
        {VIEWS.map((x) => (
          <button key={x.v} className={`btn btn-sm${range.view === x.v ? ' btn-p' : ''}`}
            style={{ border: 0, borderRadius: 0, fontSize: '.68rem', padding: '4px 12px' }}
            onClick={() => range.setView(x.v)}>{x.l}</button>
        ))}
      </div>
      <button className="btn btn-o btn-sm" onClick={range.prev} title="Précédent">◀</button>
      <span style={{ fontSize: '.8rem', fontWeight: 600, minWidth: 220 }}>{range.label}</span>
      <button className="btn btn-o btn-sm" onClick={range.next} title="Suivant">▶</button>
      <button className="btn btn-o btn-sm" onClick={range.goToday}>Aujourd&apos;hui</button>
    </div>
  );
}
