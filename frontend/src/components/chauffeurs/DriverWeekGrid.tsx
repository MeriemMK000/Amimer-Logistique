'use client';

import type { Driver, Mission } from '@/lib/types';

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const H_START = 6;
const H_END = 22;
const HOURS = H_END - H_START;

const ACT: Record<string, { label: string; color: string }> = {
  MIS: { label: 'Mission', color: 'var(--b5)' },
  MNT: { label: 'Maintenance', color: 'var(--a5)' },
  FRM: { label: 'Formation', color: 'var(--t5)' },
  TRP: { label: 'Transport pers.', color: '#7c3aed' },
  REP: { label: 'Repos', color: 'var(--s2)' },
  DIS: { label: 'Disponible', color: 'var(--g1)' },
};

function parseHour(h?: string): number | null {
  if (!h) return null;
  const m = h.match(/^(\d{1,2})/);
  return m ? parseInt(m[1], 10) : null;
}

export default function DriverWeekGrid({ drivers, missions, onOpenDriver }: {
  drivers: Driver[];
  missions: Mission[];
  onOpenDriver?: (d: Driver) => void;
}) {
  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--bd)', borderRadius: 'var(--rad)' }}>
      <div style={{ minWidth: 900 }}>
        {/* Header hours */}
        <div style={{ display: 'grid', gridTemplateColumns: '150px repeat(7, 1fr)', borderBottom: '1px solid var(--bd)', background: 'var(--s0)' }}>
          <div style={{ padding: '8px 10px', fontSize: '.72rem', fontWeight: 600, color: 'var(--tm)' }}>Chauffeur</div>
          {DAYS.map((d) => (
            <div key={d} style={{ padding: '4px 6px', borderLeft: '1px solid var(--bd)' }}>
              <div style={{ fontSize: '.7rem', fontWeight: 600, textAlign: 'center' }}>{d}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.52rem', color: 'var(--tm)' }}>
                <span>{H_START}h</span><span>14h</span><span>{H_END}h</span>
              </div>
            </div>
          ))}
        </div>

        {drivers.map((d) => (
          <div key={d.code} style={{ display: 'grid', gridTemplateColumns: '150px repeat(7, 1fr)', borderBottom: '1px solid var(--bl)', cursor: onOpenDriver ? 'pointer' : undefined }}
            onClick={() => onOpenDriver?.(d)}>
            <div style={{ padding: '6px 10px' }}>
              <div style={{ fontSize: '.75rem', fontWeight: 600 }}>{d.name}</div>
              <div style={{ fontSize: '.6rem', color: 'var(--tm)' }}>
                {d.hoursWeek}h/sem{(d as { maxWeeklyHours?: number }).maxWeeklyHours ? ` / ${(d as { maxWeeklyHours?: number }).maxWeeklyHours}` : ''}
                {(d as { apteMission?: boolean }).apteMission === false ? ' · non apte' : ''}
                {(d as { dedicatedTo?: string }).dedicatedTo ? ` · dédié` : ''}
              </div>
            </div>
            {DAYS.map((dayLabel, di) => {
              const p = (d.plan ?? [])[di] as { t?: string; h1?: string; h2?: string } | undefined;
              const act = ACT[p?.t ?? 'DIS'] ?? ACT.DIS;
              const h1 = parseHour(p?.h1) ?? (p?.t === 'REP' ? H_START : 8);
              const h2 = parseHour(p?.h2) ?? (p?.t === 'REP' ? H_END : 18);
              const occStart = p?.t === 'REP' ? H_START : Math.max(H_START, h1);
              const occEnd = p?.t === 'REP' ? H_END : Math.min(H_END, h2);
              const leftPct = ((occStart - H_START) / HOURS) * 100;
              const widthPct = Math.max(0, ((occEnd - occStart) / HOURS) * 100);
              const isOpen = p?.t === 'DIS' || !p;
              return (
                <div key={di} style={{ borderLeft: '1px solid var(--bd)', padding: '8px 6px' }}>
                  <div style={{ position: 'relative', height: 22, borderRadius: 4, background: isOpen ? 'var(--g1)' : 'var(--s2)', overflow: 'hidden' }}
                    title={`${dayLabel} — ${act.label}${p?.h1 ? ` ${p.h1}–${p.h2}` : ''}`}>
                    {!isOpen && widthPct > 0 && (
                      <div style={{ position: 'absolute', left: `${leftPct}%`, width: `${widthPct}%`, top: 0, bottom: 0, background: act.color, opacity: p?.t === 'REP' ? 0.35 : 0.9 }} />
                    )}
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.55rem', fontWeight: 600, color: isOpen ? 'var(--g6)' : '#fff' }}>
                      {isOpen ? 'Ouvert' : act.label.slice(0, 8)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, padding: 8, flexWrap: 'wrap', fontSize: '.62rem', color: 'var(--tm)' }}>
        {Object.entries(ACT).map(([k, v]) => (
          <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: v.color, display: 'inline-block' }} />{v.label}
          </span>
        ))}
      </div>
    </div>
  );
}
