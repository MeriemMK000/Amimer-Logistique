'use client';

import { useMemo } from 'react';
import BarChart from '@/components/charts/BarChart';
import { fk } from '@/lib/fleet/format';
import { toYearMonth } from '@/lib/period';

export interface InsightSeries {
  label: string;
  unit?: string;
  /** points datés — la date est normalisée en YYYY-MM. */
  points: { date: string | Date | null | undefined; value: number }[];
}

const MONTHS_ABBR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

function lastMonths(n: number): string[] {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
}

/**
 * Bloc « infos importantes » standard des rapports (demande DG — règle permanente) :
 * mois courant · comparaison mois passé · cumul · historique sur 12 mois.
 */
export default function ReportInsights({ series }: { series: InsightSeries[] }) {
  const months12 = useMemo(() => lastMonths(12), []);
  const curYm = months12[11];
  const prevYm = months12[10];

  const computed = series.map((s) => {
    const byMonth: Record<string, number> = {};
    let cumul = 0;
    for (const p of s.points) {
      const ym = toYearMonth(p.date);
      if (!ym) continue;
      byMonth[ym] = (byMonth[ym] ?? 0) + (p.value || 0);
      cumul += p.value || 0;
    }
    const cur = byMonth[curYm] ?? 0;
    const prev = byMonth[prevYm] ?? 0;
    const delta = prev === 0 ? (cur === 0 ? 0 : 100) : ((cur - prev) / Math.abs(prev)) * 100;
    return { s, byMonth, cumul, cur, prev, delta, hist: months12.map((m) => Math.round(byMonth[m] ?? 0)) };
  });

  return (
    <div className="tc" style={{ marginBottom: 12, padding: 12 }}>
      <div style={{ fontSize: '.8rem', fontWeight: 700, marginBottom: 8 }}>
        Infos importantes <span style={{ fontWeight: 400, color: 'var(--tm)' }}>— mois courant · comparaison mois passé · cumul · historique 12 mois</span>
      </div>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        {computed.map(({ s, cumul, cur, prev, delta, hist }) => {
          const up = delta >= 0;
          return (
            <div key={s.label} style={{ border: '1px solid var(--bd)', borderRadius: 'var(--rs)', padding: 10 }}>
              <div style={{ fontSize: '.72rem', color: 'var(--tm)', textTransform: 'uppercase', letterSpacing: '.03em' }}>{s.label}</div>
              <div style={{ display: 'flex', gap: 14, alignItems: 'baseline', flexWrap: 'wrap', margin: '4px 0 8px' }}>
                <div><span style={{ fontSize: '1.15rem', fontWeight: 700 }}>{fk(Math.round(cur))}</span> <span style={{ fontSize: '.65rem', color: 'var(--tm)' }}>{s.unit} · mois courant</span></div>
                <div style={{ fontSize: '.7rem', color: up ? 'var(--g6)' : 'var(--r6)', fontWeight: 600 }}>
                  {up ? '▲' : '▼'} {Math.abs(Math.round(delta))}% <span style={{ color: 'var(--tm)', fontWeight: 400 }}>vs mois passé ({fk(Math.round(prev))})</span>
                </div>
                <div style={{ fontSize: '.7rem', color: 'var(--tm)' }}>Cumul : <b style={{ color: 'var(--tp)' }}>{fk(Math.round(cumul))}</b> {s.unit}</div>
              </div>
              <BarChart
                labels={hist.map((_, i) => MONTHS_ABBR[(new Date().getMonth() - 11 + i + 12) % 12])}
                unit={s.unit}
                datasets={[{ label: s.label, values: hist, colorVar: '--c1' }]}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
