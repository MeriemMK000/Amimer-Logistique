'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAlerts, useDrivers, useFuelEntries, useMissions, useVehicles } from '@/lib/api/hooks';
import { fk } from '@/lib/fleet/format';
import { surconsoVehicles } from '@/lib/fleet/consumption';
import BarChart from '@/components/charts/BarChart';
import DonutChart from '@/components/charts/DonutChart';
import CountUp from '@/components/ui/CountUp';
import StatusBadge from '@/components/ui/StatusBadge';
import Modal from '@/components/ui/Modal';
import type { Alert, Vehicle } from '@/lib/types';

const svg = { fill: 'none', stroke: 'currentColor', strokeWidth: 2 } as const;
const truckIcon = (<svg viewBox="0 0 24 24" {...svg}><rect x="1" y="3" width="15" height="13" rx="2" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>);
const usersIcon = (<svg viewBox="0 0 24 24" {...svg}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>);
const fuelIcon = (<svg viewBox="0 0 24 24" {...svg}><path d="M3 22V5a2 2 0 012-2h8a2 2 0 012 2v17" /><path d="M15 22V10l4-2v14" /><path d="M3 22h18" /></svg>);
const alertIcon = (<svg viewBox="0 0 24 24" {...svg}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>);

// Series 6 mois — identiques a v8 initCharts()
const MO = ['Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août'];

type Drill = 'vehicules' | 'chauffeurs' | 'surconso' | 'alertes' | null;

export default function DashboardPage() {
  const router = useRouter();
  const vehicles = useVehicles();
  const drivers = useDrivers();
  const missions = useMissions();
  const fuel = useFuelEntries();
  const alerts = useAlerts();
  const [drill, setDrill] = useState<Drill>(null);

  const V = vehicles.data ?? [];
  const D = drivers.data ?? [];
  const MI = missions.data ?? [];
  const FU = fuel.data ?? [];
  const AL = alerts.data ?? [];

  const k = useMemo(() => {
    const nDis = V.filter((v) => v.status === 'DISPONIBLE').length;
    const nPanne = V.filter((v) => v.status === 'EN_PANNE').length;
    const nDrDis = D.filter((d) => d.status === 'DISPONIBLE').length;
    // Équilibre chauffeurs / véhicules conduisibles (léger + lourd) disponibles.
    const nVehDrivable = V.filter((v) => (v.type === 'LEGER' || v.type === 'LOURD') && v.status === 'DISPONIBLE').length;
    const driverSurplus = nDrDis - nVehDrivable;
    const nFatigue = D.filter((d) => (d.fatigue ?? 0) >= 0.85).length;
    const surconso = surconsoVehicles(V, MI, FU);
    const critHigh = AL.filter((a) => a.priority === 'CRITIQUE' || a.priority === 'HAUTE');
    return {
      nVh: V.length, nDis, nPanne,
      nDr: D.length, nDrDis, nFatigue, nVehDrivable, driverSurplus,
      surconso, nAl: critHigh.length, nCrit: AL.filter((a) => a.priority === 'CRITIQUE').length,
      vh_d: nDis, vh_m: V.filter((v) => v.status === 'EN_MISSION').length,
      vh_p: V.filter((v) => v.status === 'EN_PANNE' || v.status === 'HORS_SERVICE').length,
      vh_mt: V.filter((v) => v.status === 'EN_MAINTENANCE').length,
      dr_d: nDrDis, dr_m: D.filter((d) => d.status === 'EN_MISSION').length,
      dr_r: D.filter((d) => d.status === 'EN_REPOS').length,
    };
  }, [V, D, MI, FU, AL]);

  const fleetByType = [
    { label: 'Léger', value: V.filter((v) => v.type === 'LEGER').length, colorVar: '--c1' },
    { label: 'Lourd', value: V.filter((v) => v.type === 'LOURD').length, colorVar: '--c2' },
    { label: 'Engin', value: V.filter((v) => v.type === 'ENGIN').length, colorVar: '--c3' },
    { label: 'Remorque', value: V.filter((v) => v.type === 'REMORQUE').length, colorVar: '--c4' },
  ];

  const recentAlerts = AL
    .filter((a) => a.priority === 'CRITIQUE' || a.priority === 'HAUTE')
    .sort((a, b) => {
      const rank = (p: string | null) => (p === 'CRITIQUE' ? 0 : 1);
      // Les alertes automatiques (échéances, sureffectif…) remontent parmi les priorités égales.
      const auto = (x: typeof a) => (x.timeLabel === 'auto' ? 0 : 1);
      return rank(a.priority) - rank(b.priority) || auto(a) - auto(b);
    })
    .slice(0, 6);

  return (
    <div className="page active">
      <div className="sg">
        <Kpi onClick={() => setDrill('vehicules')} icon={truckIcon} iconCls="bl"
          value={k.nVh} label="Véhicules" sub={`${k.nDis} dispo · ${k.nPanne} panne`} subCls="up" />
        <Kpi onClick={() => setDrill('chauffeurs')} icon={usersIcon} iconCls="tl"
          value={k.nDr} label="Chauffeurs" sub={`${k.nDrDis} dispo · ${k.nFatigue} fatigue élevée`} subCls={k.nFatigue ? 'dn' : 'up'} />
        <Kpi onClick={() => setDrill('surconso')} icon={fuelIcon} iconCls={k.surconso.length ? 'rd' : 'gn'}
          value={k.surconso.length} label="Surconsommations"
          sub={k.surconso.length ? `${k.surconso.length} véh. hors norme` : 'Tous conformes'} subCls={k.surconso.length ? 'dn' : 'up'} />
        <Kpi onClick={() => setDrill('alertes')} icon={alertIcon} iconCls="rd"
          value={k.nAl} label="Alertes Critiques" sub={`${k.nCrit} critiques`} subCls="dn" />
      </div>

      <div className="cr">
        <div className="cc">
          <h3>Coûts Opérationnels</h3>
          <div className="sub">6 mois — Maintenance + Carburant (K DA)</div>
          <BarChart
            labels={MO}
            unit="K DA"
            datasets={[
              { label: 'Maintenance', values: [620, 480, 750, 580, 890, 1284], colorVar: '--c1' },
              { label: 'Carburant', values: [2400, 2680, 2520, 2750, 2900, 2840], colorVar: '--c2' },
            ]}
          />
          <div className="lg">
            <div className="li"><span className="ld" style={{ background: 'var(--c1)' }} />Maintenance</div>
            <div className="li"><span className="ld" style={{ background: 'var(--c2)' }} />Carburant</div>
          </div>
        </div>
        <div className="cc">
          <h3>Répartition Flotte</h3>
          <div className="sub">Par type</div>
          <DonutChart data={fleetByType} />
        </div>
      </div>

      <div className="cr">
        <div className="cc">
          <h3>Disponibilité</h3>
          <div className="sub">Vision Véhicules &amp; Chauffeurs</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <DispoCol title="Véhicules"
              line={<>Dispo: <b style={{ color: 'var(--g6)' }}>{k.vh_d}</b> · Mission: <b style={{ color: 'var(--b6)' }}>{k.vh_m}</b> · Panne/HS: <b style={{ color: 'var(--r6)' }}>{k.vh_p}</b> · Maint: <b style={{ color: 'var(--a6)' }}>{k.vh_mt}</b></>}
              pct={k.nVh ? Math.round((k.vh_d / k.nVh) * 100) : 0} />
            <DispoCol title="Chauffeurs"
              line={<>Dispo: <b style={{ color: 'var(--g6)' }}>{k.dr_d}</b> · Mission: <b style={{ color: 'var(--b6)' }}>{k.dr_m}</b> · Repos: <b style={{ color: 'var(--a6)' }}>{k.dr_r}</b></>}
              pct={k.nDr ? Math.round((k.dr_d / k.nDr) * 100) : 0} />
          </div>
          {k.driverSurplus > 0 && (
            <div
              onClick={() => router.push('/alertes')}
              style={{ cursor: 'pointer', marginTop: 10, padding: '8px 10px', borderRadius: 8, background: 'var(--r1)', border: '1px solid var(--r5)', fontSize: '.72rem', color: 'var(--r6)', display: 'flex', gap: 8, alignItems: 'center' }}
            >
              
              <span>
                <b>{k.nVehDrivable}</b> véhicule(s) léger/lourd disponible(s) pour <b>{k.dr_d}</b> chauffeur(s) disponible(s) —
                mettre <b>{k.driverSurplus}</b> chauffeur(s) en repos / récupération.
              </span>
            </div>
          )}
        </div>
        <div className="cc">
          <h3>Alertes Récentes</h3>
          <div className="sub">Critiques et hautes</div>
          <div className="al">
            {recentAlerts.map((a) => (
              <div className="ai" key={a.id} style={{ padding: '10px 12px', cursor: 'pointer' }} onClick={() => router.push('/alertes')}>
                <div className={`ak ${a.type ?? 'wr'}`} style={{ width: 26, height: 26 }}>
                  <svg viewBox="0 0 24 24" {...svg} style={{ width: 13, height: 13 }}>
                    {a.type === 'dg'
                      ? <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      : <circle cx="12" cy="12" r="10" />}
                  </svg>
                </div>
                <div style={{ flex: 1 }}><div className="at" style={{ fontSize: '.75rem' }}>{a.title}</div></div>
                <span className="atm">{a.timeLabel}</span>
                <StatusBadge status={a.priority} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <DrillModal drill={drill} onClose={() => setDrill(null)}
        vehicles={V} drivers={D} surconso={k.surconso}
        alerts={AL.filter((a) => a.priority === 'CRITIQUE' || a.priority === 'HAUTE')} />
    </div>
  );
}

function Kpi({ onClick, icon, iconCls, value, label, sub, subCls }: {
  onClick: () => void; icon: React.ReactNode; iconCls: string; value: number; label: string; sub: string; subCls: string;
}) {
  return (
    <div className="sc drill" onClick={onClick} style={{ cursor: 'pointer' }}>
      <div>
        <div className="sv"><CountUp value={value} /></div>
        <div className="sl">{label}</div>
        <div className={`st ${subCls}`}>{sub}</div>
      </div>
      <div className={`si ${iconCls}`}>{icon}</div>
    </div>
  );
}

function DispoCol({ title, line, pct }: { title: string; line: React.ReactNode; pct: number }) {
  return (
    <div>
      <div style={{ fontSize: '.78rem', fontWeight: 600, marginBottom: 8, color: 'var(--tp)' }}>{title}</div>
      <div style={{ fontSize: '.75rem', color: 'var(--ts)', marginBottom: 4 }}>{line}</div>
      <div className="pb" style={{ height: 8 }}><div className="pf" style={{ width: `${pct}%`, background: 'var(--g5)' }} /></div>
      <div style={{ fontSize: '.65rem', color: 'var(--tm)', marginTop: 2 }}>Taux dispo: {pct}%</div>
    </div>
  );
}

function DrillModal({ drill, onClose, vehicles, drivers, surconso, alerts }: {
  drill: Drill; onClose: () => void; vehicles: Vehicle[]; drivers: ReturnType<typeof useDrivers>['data']; surconso: Vehicle[]; alerts: Alert[];
}) {
  const titles: Record<string, string> = {
    vehicules: `Détail Flotte (${vehicles.length} véhicules)`,
    chauffeurs: `Détail Chauffeurs (${drivers?.length ?? 0})`,
    surconso: `Surconsommations (${surconso.length})`,
    alertes: `Alertes Critiques & Hautes (${alerts.length})`,
  };
  return (
    <Modal open={!!drill} onClose={onClose} title={drill ? titles[drill] : ''}
      footer={<button className="btn btn-o" onClick={onClose}>Fermer</button>}>
      <div className="drill-list">
        {drill === 'vehicules' && vehicles.map((v) => (
          <div className="drill-item" key={v.code}>
            <div><div style={{ fontWeight: 600, color: 'var(--tp)' }}>{v.code} — {v.brand} {v.model}</div>
              <div style={{ fontSize: '.7rem', color: 'var(--tm)' }}>{v.type} · {fk(v.km)} km · {v.fuel}</div></div>
            <div className="drill-val"><StatusBadge status={v.status} /></div>
          </div>
        ))}
        {drill === 'chauffeurs' && [...(drivers ?? [])].sort((a, b) => (b.fatigue ?? 0) - (a.fatigue ?? 0)).map((d) => (
          <div className="drill-item" key={d.code}>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 600, color: 'var(--tp)' }}>{d.name} ({d.code})</div>
              <div style={{ fontSize: '.7rem', color: 'var(--tm)' }}>Permis {d.license} · {d.hoursWeek}h/sem · VH: {d.vehicleCode || '—'}</div></div>
            <span style={{ fontWeight: 600 }}>{Math.round((d.fatigue ?? 0) * 100)}%</span>
            <StatusBadge status={d.status} />
          </div>
        ))}
        {drill === 'surconso' && (surconso.length ? surconso.map((v) => (
          <div className="drill-item" key={v.code}>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 600, color: 'var(--tp)' }}>{v.code} — {v.brand} {v.model}</div>
              <div style={{ fontSize: '.7rem', color: 'var(--tm)' }}>Norme corrigée: {v.normCorr}</div></div>
          </div>
        )) : <p style={{ padding: 20, fontSize: '.85rem', color: 'var(--g6)', textAlign: 'center' }}>Tous les véhicules sont conformes aux normes.</p>)}
        {drill === 'alertes' && alerts.map((a) => (
          <div className="drill-item" key={a.id}>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 500, color: 'var(--tp)', fontSize: '.78rem' }}>{a.title}</div>
              <div style={{ fontSize: '.7rem', color: 'var(--tm)' }}>{a.description}</div></div>
            <StatusBadge status={a.priority} />
          </div>
        ))}
      </div>
    </Modal>
  );
}
