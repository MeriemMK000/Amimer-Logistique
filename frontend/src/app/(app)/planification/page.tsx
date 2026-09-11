'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useConfig, useDrivers, useMaintenanceOrders, useMissions, useVehicles } from '@/lib/api/hooks';
import Tabs from '@/components/ui/Tabs';
import PlanningNav from '@/components/ui/PlanningNav';
import { usePlanningRange } from '@/lib/planningRange';
import { fk } from '@/lib/fleet/format';
import { runSelection, type Weights } from '@/lib/fleet/scoring';
import { useProposal } from '@/lib/api/hooks';
import { PROPOSAL_WEIGHT_ROWS, normalizeProposalConfig, effectiveWeights } from '@/lib/fleet/proposalConfig';
import type { ProposalConfig } from '@/lib/types';

// Plan hebdo récurrent du chauffeur : index = jour de la semaine (0 = dimanche).
const PLAN_MAP: Record<string, [string, string]> = {
  MIS: ['Mission', 'pt-mis'], REP: ['Repos', 'pt-rep'], DIS: ['Dispo', 'pt-dis'],
  MNT: ['Maint.', 'pt-mnt'], FRM: ['Formation', 'pt-frm'], TRP: ['Transp.', 'pt-trp'],
};
const scCls = (s: number) => (s >= 70 ? 'score-hi' : s >= 40 ? 'score-md' : 'score-lo');

export default function PlanificationPage() {
  const [tab, setTab] = useState(0);
  const vehicles = useVehicles();
  const drivers = useDrivers();
  const missions = useMissions();
  const maint = useMaintenanceOrders();
  const range = usePlanningRange('week');

  const V = vehicles.data ?? [];
  const D = drivers.data ?? [];
  const MI = missions.data ?? [];
  const MT = maint.data ?? [];

  return (
    <div className="page active">
      <Tabs tabs={['Disponibilité Véhicules', 'Disponibilité Chauffeurs', 'Sélection Automatique']} active={tab} onChange={setTab} />

      {tab === 0 && (
        <div className="tpane act">
          <PlanningNav range={range} />
          <div className="lg" style={{ marginBottom: 8 }}>
            <div className="li"><span className="ld" style={{ background: 'var(--b5)' }} />Mission</div>
            <div className="li"><span className="ld" style={{ background: 'var(--r5)' }} />Panne</div>
            <div className="li"><span className="ld" style={{ background: 'var(--a5)' }} />Maint.</div>
          </div>
          <div className="tw" style={{ overflowX: 'auto' }}>
            <table style={{ fontSize: '.7rem', minWidth: range.days.length * 40 + 150 }}>
              <thead><tr><th style={{ minWidth: 140, position: 'sticky', left: 0, background: 'var(--s1)', zIndex: 1 }}>Véhicule</th>
                {range.days.map((d) => <th key={d.iso} style={{ textAlign: 'center', minWidth: 36, background: d.weekend ? 'var(--b0)' : undefined }}>{d.d}<br /><span style={{ fontWeight: 400, color: 'var(--tm)', fontSize: '.55rem' }}>{d.dow}</span></th>)}</tr></thead>
              <tbody>
                {V.filter((v) => v.type !== 'REMORQUE').map((v) => (
                  <tr key={v.code}>
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap', position: 'sticky', left: 0, background: 'var(--s1)', zIndex: 1 }}>{v.code} <span style={{ fontWeight: 400, color: 'var(--tm)' }}>{v.brand}</span></td>
                    {range.days.map((day) => {
                      const mis = MI.find((m) => m.vehicleCode === v.code && (m.dateStart ?? '') <= day.iso && (m.dateEnd ?? '') >= day.iso && m.status !== 'ANNULEE');
                      const cell = mis
                        ? { bg: mis.status === 'CLOTUREE' ? 'var(--g5)' : 'var(--b5)', txt: mis.num.slice(-4), title: `${mis.num} · ${mis.fromLoc} → ${mis.toLoc} (${mis.status})` }
                        : v.status === 'EN_PANNE' ? { bg: 'var(--r5)', txt: 'Panne', title: 'En panne' }
                          : v.status === 'EN_MAINTENANCE' ? { bg: 'var(--a5)', txt: 'Maint.', title: 'En maintenance' }
                            : null;
                      return (
                        <td key={day.iso} style={{ textAlign: 'center', padding: 2, background: day.weekend ? 'var(--b0)' : undefined }}>
                          {cell ? <span title={cell.title} style={{ display: 'block', background: cell.bg, color: '#fff', borderRadius: 3, padding: '2px 3px', fontSize: '.55rem' }}>{cell.txt}</span> : <span style={{ color: 'var(--tm)' }}>·</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 1 && (
        <div className="tpane act">
          <PlanningNav range={range} />
          <div className="lg" style={{ marginBottom: 8 }}>
            <div className="li"><span className="ld" style={{ background: 'var(--b5)' }} />Mission</div>
            <div className="li"><span className="ld" style={{ background: 'var(--r5)' }} />Repos / congé</div>
            <div className="li"><span className="ld" style={{ background: 'var(--g5)' }} />Dispo</div>
          </div>
          <div className="tw" style={{ overflowX: 'auto' }}>
            <table style={{ fontSize: '.7rem', minWidth: range.days.length * 40 + 150 }}>
              <thead><tr><th style={{ minWidth: 140, position: 'sticky', left: 0, background: 'var(--s1)', zIndex: 1 }}>Chauffeur</th>
                {range.days.map((d) => <th key={d.iso} style={{ textAlign: 'center', minWidth: 36, background: d.weekend ? 'var(--b0)' : undefined }}>{d.d}<br /><span style={{ fontWeight: 400, color: 'var(--tm)', fontSize: '.55rem' }}>{d.dow}</span></th>)}</tr></thead>
              <tbody>
                {D.map((dr) => (
                  <tr key={dr.code}>
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap', position: 'sticky', left: 0, background: 'var(--s1)', zIndex: 1 }}>{dr.name?.split(' ')[0]} <span style={{ fontWeight: 400, color: 'var(--tm)', fontSize: '.6rem' }}>{dr.vehicleCode || ''}</span></td>
                    {range.days.map((day) => {
                      const mis = MI.find((m) => m.driverCode === dr.code && (m.dateStart ?? '') <= day.iso && (m.dateEnd ?? '') >= day.iso && !['ANNULEE', 'CLOTUREE'].includes(m.status));
                      const wd = new Date(day.iso).getDay();
                      const slot = (dr.plan ?? [])[wd];
                      let cell: { bg: string; txt: string; title: string } | null = null;
                      if (mis) cell = { bg: 'var(--b5)', txt: mis.num.slice(-4), title: `${mis.num} · ${mis.fromLoc} → ${mis.toLoc}` };
                      else if (['EN_REPOS', 'EN_CONGE', 'CONGE'].includes(dr.status ?? '')) cell = { bg: 'var(--r5)', txt: 'Repos', title: dr.status ?? '' };
                      else if (slot && (slot.t === 'REP')) cell = { bg: 'var(--r4)', txt: 'Repos', title: 'Repos hebdo' };
                      else if (slot && (slot.t === 'FRM')) cell = { bg: 'var(--a5)', txt: 'Form.', title: 'Formation' };
                      else if (slot && (slot.t === 'TRP')) cell = { bg: 'var(--a4)', txt: 'Transp.', title: 'Transport personnel' };
                      else if (!day.weekend) cell = { bg: 'var(--g5)', txt: 'Dispo', title: 'Disponible' };
                      return (
                        <td key={day.iso} style={{ textAlign: 'center', padding: 2, background: day.weekend ? 'var(--b0)' : undefined }}>
                          {cell ? <span title={cell.title} style={{ display: 'block', background: cell.bg, color: '#fff', borderRadius: 3, padding: '2px 3px', fontSize: '.55rem' }}>{cell.txt}</span> : <span style={{ color: 'var(--tm)' }}>·</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 2 && <AutoSelection drivers={D} vehicles={V} />}
    </div>
  );
}

function AutoSelection({ drivers, vehicles }: { drivers: import('@/lib/types').Driver[]; vehicles: import('@/lib/types').Vehicle[] }) {
  const cfgQ = useConfig<ProposalConfig>('PROPOSAL_CONFIG');
  const cfg = normalizeProposalConfig(cfgQ.data);
  const effW = effectiveWeights(cfg);
  const [type, setType] = useState('LOURD');
  const [cargo, setCargo] = useState('Non');
  const [ran, setRan] = useState(false);
  const proposal = useProposal();
  const [backendResult, setBackendResult] = useState<{ drivers: any[]; vehicles: any[] } | null>(null);

  // Fallback client-side (immédiat) + résultat backend (partagé avec le module Mission).
  // Les poids viennent de Paramètres › Sélection automatique (source unique).
  const localResult = useMemo(() => {
    const w: Weights = {
      fat: effW.fat ?? 0, hrs: effW.hrs ?? 0, qual: effW.qual ?? 0,
      km: effW.km ?? 0, doc: effW.doc ?? 0, conso: effW.conso ?? 0,
    };
    return runSelection(drivers, vehicles, { type, cargo, weights: w });
  }, [drivers, vehicles, type, cargo, effW]);

  const runBackend = async () => {
    setRan(true);
    const cargoQual = cargo.includes('ADR') ? 'ADR' : cargo === 'Frigorifique' ? 'Frigo' : cargo === 'Citerne' ? 'Citerne' : undefined;
    const res = await proposal.mutateAsync({
      vehicleType: type,
      requiredQual: cargoQual,
      qualityCriteria: cargo !== 'Non' ? cargo : undefined,
      // pas de `weights` ici → le backend applique la config Paramètres (source unique).
    }).catch(() => null);
    setBackendResult(res);
  };
  const result = backendResult
    ? {
        drivers: backendResult.drivers.map((d) => ({ d: { code: d.code, name: d.name, license: d.license, hoursWeek: d.hoursWeek, fatigue: d.fatigue, vehicleCode: null }, sc: d.score })),
        vehicles: backendResult.vehicles.map((v) => ({ v: { code: v.code, brand: v.label.split(' ')[0] ?? '', model: v.label.split(' ').slice(1).join(' '), km: v.km, normOff: null, ownership: '' }, sc: v.score })),
      }
    : localResult;

  return (
    <div className="tpane act">
      <div className="sel-box">
        <h3>Sélection Automatique Chauffeur &amp; Véhicule</h3>
        <p style={{ fontSize: '.78rem', color: 'var(--ts)', marginBottom: 14 }}>
          L’algorithme utilise les poids définis dans{' '}
          <Link href="/parametres" style={{ color: 'var(--b6)', fontWeight: 600 }}>Paramètres › Sélection automatique</Link>{' '}
          — mêmes réglages que le bouton « Proposer » de la modale mission.
        </p>
        <div className="cfg-panel">
          <div style={{ fontSize: '.78rem', fontWeight: 600, marginBottom: 8, color: 'var(--tp)' }}>Poids actifs de l’algorithme</div>
          {PROPOSAL_WEIGHT_ROWS.map((r) => {
            const off = cfg.enabled[r.key] === false;
            return (
              <div className="cfg-row" key={r.key} style={{ opacity: off ? 0.4 : 1 }}>
                <label style={{ flex: 1 }}>{r.label} <span style={{ color: 'var(--tm)', fontWeight: 400 }}>· {r.scope === 'vehicule' ? 'véhicule' : 'chauffeur'}</span></label>
                <span className="cfg-val">{off ? 'off' : (effW[r.key] ?? 0)}</span>
              </div>
            );
          })}
        </div>
        <div className="sel-form">
          <div className="sel-grp"><label>Type Véhicule</label><select value={type} onChange={(e) => setType(e.target.value)}>{['LEGER', 'LOURD', 'ENGIN'].map((t) => <option key={t}>{t}</option>)}</select></div>
          <div className="sel-grp"><label>Cargo</label><select value={cargo} onChange={(e) => setCargo(e.target.value)}>{['Non', 'ADR (mat. dangereuses)', 'Frigorifique', 'Citerne'].map((c) => <option key={c}>{c}</option>)}</select></div>
        </div>
        <button className="btn btn-p" onClick={runBackend} style={{ marginBottom: 16 }}>Lancer la Sélection</button>
        {ran && (
          <div className="sel-results">
            <div className="sel-card">
              <h4>Chauffeurs Recommandés</h4>
              {result.drivers.length ? result.drivers.map((x, i) => (
                <div className="sel-row" key={x.d.code}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontWeight: 600, color: 'var(--tp)' }}>{i + 1}. {x.d.name}</span>
                    <div style={{ fontSize: '.7rem', color: 'var(--tm)' }}>Permis {x.d.license} · {x.d.hoursWeek}h/sem · Fat. {Math.round((x.d.fatigue ?? 0) * 100)}%</div>
                  </div>
                  <span className={`sel-score ${scCls(x.sc)}`}>{x.sc}/100</span>
                </div>
              )) : <div style={{ padding: 12, fontSize: '.8rem', color: 'var(--tm)' }}>Aucun disponible</div>}
            </div>
            <div className="sel-card">
              <h4>Véhicules Recommandés</h4>
              {result.vehicles.length ? result.vehicles.map((x, i) => (
                <div className="sel-row" key={x.v.code}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontWeight: 600, color: 'var(--tp)' }}>{i + 1}. {x.v.code} — {x.v.brand} {x.v.model}</span>
                    <div style={{ fontSize: '.7rem', color: 'var(--tm)' }}>{fk(x.v.km)} km · {x.v.normOff} L/100 · {x.v.ownership}</div>
                  </div>
                  <span className={`sel-score ${scCls(x.sc)}`}>{x.sc}/100</span>
                </div>
              )) : <div style={{ padding: 12, fontSize: '.8rem', color: 'var(--tm)' }}>Aucun disponible</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

