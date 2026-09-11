'use client';

import { isValidElement, useMemo, useState, type ReactNode } from 'react';
import {
  useAlerts, useConfig, useDrivers, useFuelControlMonth, useFuelEntries, useMaintenanceOrders, useMissions, useVehicles,
} from '@/lib/api/hooks';
import Tabs from '@/components/ui/Tabs';
import KpiTile from '@/components/ui/KpiTile';
import StatusBadge from '@/components/ui/StatusBadge';
import BarChart from '@/components/charts/BarChart';
import DonutChart from '@/components/charts/DonutChart';
import ReportInsights from '@/components/ui/ReportInsights';
import { fd, fk } from '@/lib/fleet/format';
import { vhMissionKm } from '@/lib/fleet/consumption';
import { calcFraisMission, type BaremeMission } from '@/lib/fleet/bareme';
import { downloadCSV } from '@/lib/export';
import type { Alert, Driver, FuelEntry, MaintenanceOrder, Mission, Vehicle } from '@/lib/types';

const REPORTS = ['Flotte', 'Chauffeurs', 'Missions', 'Maintenance', 'Carburant', 'Frais', 'Kilométrage', 'Alertes', 'Constructeur'];

const CURRENT_MONTH = new Date().toISOString().slice(0, 7);
const CTRL_METHOD_SHORT: Record<string, string> = { mission: 'Mission', km_difference: 'Différence km', hours: 'Heures' };
const V_LBL: Record<string, string> = { conforme: 'Conforme', surveiller: 'À surveiller', anomalie: 'Anomalie', incomplet: 'Incomplet' };
const V_COLOR: Record<string, string> = { conforme: 'var(--g6)', surveiller: 'var(--a6)', anomalie: 'var(--r6)', incomplet: 'var(--b6)' };

export default function RapportsPage() {
  const [tab, setTab] = useState(0);
  const v = useVehicles(); const d = useDrivers(); const mi = useMissions();
  const mt = useMaintenanceOrders(); const fu = useFuelEntries(); const al = useAlerts();
  const bareme = useConfig<BaremeMission>('BAREME_MISSION');

  const V = v.data ?? []; const D = d.data ?? []; const MI = mi.data ?? [];
  const MT = mt.data ?? []; const FU = fu.data ?? []; const AL = al.data ?? [];
  const B = bareme.data;
  const drName = (c: string | null) => D.find((x) => x.code === c)?.name ?? c ?? '—';

  return (
    <div className="page active">
      <Tabs tabs={REPORTS} active={tab} onChange={setTab} />
      <div className="tpane act">
        {tab === 0 && <FlotteReport V={V} />}
        {tab === 1 && <ChauffeursReport D={D} MI={MI} />}
        {tab === 2 && <MissionsReport MI={MI} drName={drName} />}
        {tab === 3 && <MaintenanceReport MT={MT} />}
        {tab === 4 && <CarburantReport V={V} FU={FU} MI={MI} />}
        {tab === 5 && <FraisReport MI={MI} V={V} B={B} drName={drName} />}
        {tab === 6 && <KmReport V={V} MI={MI} />}
        {tab === 7 && <AlertesReport AL={AL} />}
        {tab === 8 && <ReportBuilder V={V} D={D} MI={MI} MT={MT} FU={FU} AL={AL} drName={drName} />}
      </div>
    </div>
  );
}

/** Extrait le texte d'un noeud React (pour l'export CSV des tableaux). */
function nodeText(n: ReactNode): string {
  if (n == null || n === false || n === true) return '';
  if (typeof n === 'string' || typeof n === 'number') return String(n);
  if (Array.isArray(n)) return n.map(nodeText).join(' ');
  if (isValidElement(n)) {
    const p = n.props as { status?: unknown; children?: ReactNode };
    if (p?.status != null) return String(p.status);
    return nodeText(p?.children);
  }
  return '';
}

function Table({ head, rows, exportName }: { head: string[]; rows: ReactNode[][]; exportName?: string }) {
  return (
    <div className="tc">
      {exportName && (
        <div style={{ padding: '8px 10px 0', textAlign: 'right' }}>
          <button className="btn btn-o btn-sm" onClick={() => downloadCSV(exportName, head, rows.map((r) => r.map(nodeText)))}>
            Export CSV
          </button>
        </div>
      )}
      <div className="tw"><table>
        <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
      </table></div>
    </div>
  );
}

const CC = ['--c1', '--c2', '--c3', '--c4'];

/** Bloc graphiques d'un rapport : cartes responsives (barres / donut). */
function Charts({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, marginBottom: 16 }}>
      {children}
    </div>
  );
}
function ChartCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="cc">
      <h3>{title}</h3>
      {sub && <div className="sub">{sub}</div>}
      <div style={{ marginTop: 8 }}>{children}</div>
    </div>
  );
}
/** Barres verticales simples (label -> valeur), tri décroissant, top N. */
function Bars({ data, unit = '', top = 10, colorVar = '--c1' }: { data: { label: string; value: number }[]; unit?: string; top?: number; colorVar?: string }) {
  const d = [...data].sort((a, b) => b.value - a.value).slice(0, top);
  return <BarChart labels={d.map((x) => x.label)} datasets={[{ label: '', values: d.map((x) => Math.round(x.value)), colorVar }]} unit={unit} height={230} />;
}

function FlotteReport({ V }: { V: import('@/lib/types').Vehicle[] }) {
  const dispo = V.filter((x) => x.status === 'DISPONIBLE').length;
  const taux = V.length ? Math.round((dispo / V.length) * 100) : 0;
  const byType = ['LEGER', 'LOURD', 'ENGIN', 'REMORQUE'].map((t, i) => ({ label: t, value: V.filter((x) => x.type === t).length, colorVar: CC[i] }));
  const byStatus = [...new Set(V.map((x) => x.status))].map((s, i) => ({ label: String(s), value: V.filter((x) => x.status === s).length, colorVar: CC[i % 4] }));
  return (
    <>
      <div className="rap-kpi-row">
        <KpiTile label="Total Véhicules" value={V.length} sub="Parc complet" cls="kpi-b" />
        <KpiTile label="Disponibles" value={dispo} sub={`${taux}% du parc`} cls="kpi-g" />
        <KpiTile label="En Mission" value={V.filter((x) => x.status === 'EN_MISSION').length} cls="kpi-b" />
        <KpiTile label="En Panne / HS" value={V.filter((x) => x.status === 'EN_PANNE' || x.status === 'HORS_SERVICE').length} cls="kpi-r" />
        <KpiTile label="Taux Disponibilité" value={`${taux}%`} sub="Objectif : 80%" cls="kpi-t" />
      </div>
      <Charts>
        <ChartCard title="Répartition par type"><DonutChart data={byType} /></ChartCard>
        <ChartCard title="Répartition par statut"><Bars data={byStatus} colorVar="--c3" /></ChartCard>
        <ChartCard title="Kilométrage par véhicule" sub="Compteur actuel"><Bars data={V.map((x) => ({ label: x.code, value: x.km ?? 0 }))} unit=" km" colorVar="--c1" /></ChartCard>
      </Charts>
      <Table exportName="rapport-flotte" head={['Code', 'Véhicule', 'Type', 'Immat.', 'Statut', 'Km', 'Propriété', 'Conso Norme']}
        rows={V.map((x) => [x.code, `${x.brand} ${x.model}`, x.type, x.plate, <StatusBadge key="s" status={x.status} />, fk(x.km), x.ownership, `${x.normOff} L/100`])} />
    </>
  );
}

function ChauffeursReport({ D, MI }: { D: import('@/lib/types').Driver[]; MI: import('@/lib/types').Mission[] }) {
  return (
    <>
      <ReportInsights series={[
        { label: 'Missions chauffeurs', unit: '', points: MI.filter((m) => m.driverCode).map((m) => ({ date: m.dateStart, value: 1 })) },
      ]} />
      <div className="rap-kpi-row">
        <KpiTile label="Total Chauffeurs" value={D.length} cls="kpi-b" />
        <KpiTile label="Disponibles" value={D.filter((x) => x.status === 'DISPONIBLE').length} cls="kpi-g" />
        <KpiTile label="Fatigue élevée" value={D.filter((x) => (x.fatigue ?? 0) >= 0.85).length} cls="kpi-r" />
        <KpiTile label="Heures moy./sem" value={D.length ? Math.round(D.reduce((s, x) => s + (x.hoursWeek ?? 0), 0) / D.length) : 0} cls="kpi-t" />
      </div>
      <Charts>
        <ChartCard title="Missions par chauffeur"><Bars data={D.map((x) => ({ label: x.name.split(' ')[0], value: MI.filter((m) => m.driverCode === x.code).length }))} colorVar="--c1" /></ChartCard>
        <ChartCard title="Heures / semaine" sub="Charge de travail"><Bars data={D.map((x) => ({ label: x.name.split(' ')[0], value: x.hoursWeek ?? 0 }))} unit=" h" colorVar="--c2" /></ChartCard>
        <ChartCard title="Fatigue" sub="% par chauffeur"><Bars data={D.map((x) => ({ label: x.name.split(' ')[0], value: Math.round((x.fatigue ?? 0) * 100) }))} unit=" %" colorVar="--c4" /></ChartCard>
      </Charts>
      <Table exportName="rapport-chauffeurs" head={['N°', 'Nom', 'Permis', 'Statut', 'H/sem', 'Fatigue', 'Missions']}
        rows={D.map((x) => [x.code, x.name, x.license, <StatusBadge key="s" status={x.status} />, `${x.hoursWeek}h`, `${Math.round((x.fatigue ?? 0) * 100)}%`, MI.filter((m) => m.driverCode === x.code).length])} />
    </>
  );
}

function MissionsReport({ MI, drName }: { MI: import('@/lib/types').Mission[]; drName: (c: string | null) => string }) {
  const km = MI.reduce((s, m) => s + (m.distance ?? 0), 0);
  const byStatus = [...new Set(MI.map((m) => m.status))].map((s, i) => ({ label: String(s), value: MI.filter((m) => m.status === s).length, colorVar: CC[i % 4] }));
  const byZone = [...new Set(MI.map((m) => m.zone ?? '—'))].map((z, i) => ({ label: String(z), value: MI.filter((m) => (m.zone ?? '—') === z).length, colorVar: CC[i % 4] }));
  const byMonth: Record<string, number> = {};
  MI.forEach((m) => { const k = (m.dateStart ?? '').slice(0, 7); if (k) byMonth[k] = (byMonth[k] ?? 0) + (m.distance ?? 0); });
  return (
    <>
      <ReportInsights series={[
        { label: 'Missions', unit: '', points: MI.map((m) => ({ date: m.dateStart, value: 1 })) },
        { label: 'Km parcourus', unit: 'km', points: MI.map((m) => ({ date: m.dateStart, value: m.distance ?? 0 })) },
      ]} />
      <div className="rap-kpi-row">
        <KpiTile label="Total Missions" value={MI.length} cls="kpi-b" />
        <KpiTile label="En Cours" value={MI.filter((m) => m.status === 'EN_COURS').length} cls="kpi-a" />
        <KpiTile label="Terminées" value={MI.filter((m) => m.status === 'TERMINEE' || m.status === 'CLOTUREE').length} cls="kpi-g" />
        <KpiTile label="Km Total" value={fk(km)} cls="kpi-t" />
        <KpiTile label="Multipoint" value={MI.filter((m) => (m.waypoints?.length ?? 0) > 0).length} cls="kpi-b" />
      </div>
      <Charts>
        <ChartCard title="Missions par statut"><DonutChart data={byStatus} centerUnit="missions" /></ChartCard>
        <ChartCard title="Km par mois"><Bars data={Object.entries(byMonth).map(([k, v]) => ({ label: k, value: v }))} unit=" km" top={12} colorVar="--c1" /></ChartCard>
        <ChartCard title="Missions par zone"><Bars data={byZone} colorVar="--c3" /></ChartCard>
      </Charts>
      <Table exportName="rapport-missions" head={['N°', 'Trajet', 'Chauffeur', 'Véhicule', 'Distance', 'Zone', 'Statut']}
        rows={MI.map((m) => [m.num, `${m.fromLoc} → ${m.toLoc}`, drName(m.driverCode), m.vehicleCode, `${fk(m.distance)} km`, m.zone, <StatusBadge key="s" status={m.status} />])} />
    </>
  );
}

function MaintenanceReport({ MT }: { MT: import('@/lib/types').MaintenanceOrder[] }) {
  const cost = MT.reduce((s, o) => s + (o.totalCost ?? 0), 0);
  const byType = [...new Set(MT.map((o) => o.type ?? '—'))].map((t, i) => ({ label: String(t), value: MT.filter((o) => (o.type ?? '—') === t).length, colorVar: CC[i % 4] }));
  const costByVeh: Record<string, number> = {};
  MT.forEach((o) => { const k = o.vehicleCode ?? '—'; costByVeh[k] = (costByVeh[k] ?? 0) + (o.totalCost ?? 0); });
  return (
    <>
      <ReportInsights series={[
        { label: 'OT', unit: '', points: MT.map((o) => ({ date: o.date, value: 1 })) },
        { label: 'Coût maintenance', unit: 'DA', points: MT.map((o) => ({ date: o.date, value: o.totalCost ?? 0 })) },
      ]} />
      <div className="rap-kpi-row">
        <KpiTile label="Total OT" value={MT.length} cls="kpi-b" />
        <KpiTile label="Périodiques" value={MT.filter((o) => o.type === 'PERIODIQUE').length} cls="kpi-g" />
        <KpiTile label="Curatifs" value={MT.filter((o) => o.type === 'CURATIVE').length} cls="kpi-r" />
        <KpiTile label="Coût Total" value={`${fk(cost)} DA`} cls="kpi-a" />
        <KpiTile label="Coût Moyen" value={MT.length ? `${fk(Math.round(cost / MT.length))} DA` : '—'} cls="kpi-t" />
      </div>
      <Charts>
        <ChartCard title="OT par type" sub="Préventif vs curatif"><DonutChart data={byType} centerUnit="OT" /></ChartCard>
        <ChartCard title="Coût maintenance par véhicule"><Bars data={Object.entries(costByVeh).map(([k, v]) => ({ label: k, value: v }))} unit=" DA" colorVar="--c2" /></ChartCard>
      </Charts>
      <Table exportName="rapport-maintenance" head={['N° OT', 'Véhicule', 'Type', 'Titre', 'Priorité', 'Statut', 'Coût', 'Date']}
        rows={MT.map((o) => [o.num, o.vehicleCode, o.type, o.title, <StatusBadge key="p" status={o.priority} />, <StatusBadge key="s" status={o.status} />, `${fk(o.totalCost)} DA`, o.date])} />
    </>
  );
}

function CarburantReport({ V, FU, MI }: { V: import('@/lib/types').Vehicle[]; FU: import('@/lib/types').FuelEntry[]; MI: import('@/lib/types').Mission[] }) {
  // Retour DG : mêmes chiffres que le module Contrôle — km/heures FAIT réel (relevés début→fin
  // pour la différence de km, missions pour le contrôle mission, heures pour les engins),
  // conso nette, écart, verdict. Fini le « 0 km » pour l'Audi qui ne fait pas de missions.
  const fc = useFuelControlMonth(CURRENT_MONTH);
  const rows = fc.data ?? [];
  const totalL = FU.reduce((s, f) => s + (f.qty ?? 0), 0);
  const totalCost = FU.reduce((s, f) => s + (f.amount ?? (f.qty ?? 0) * (f.unitPrice ?? 0)), 0);
  const withNorm = rows.filter((r: any) => r.norme != null && r.consoReelle != null);
  const horsMission = rows.filter((r: any) => (r.kmNonJustifie ?? 0) > 0);

  return (
    <>
      <ReportInsights series={[
        { label: 'Litres', unit: 'L', points: FU.map((f) => ({ date: f.date, value: f.qty ?? 0 })) },
        { label: 'Coût carburant', unit: 'DA', points: FU.map((f) => ({ date: f.date, value: (f.amount ?? (f.qty ?? 0) * (f.unitPrice ?? 0)) })) },
      ]} />
      <div className="rap-kpi-row">
        <KpiTile label="Total Litres" value={fk(Math.round(totalL))} cls="kpi-b" />
        <KpiTile label="Coût Total" value={`${fk(Math.round(totalCost))} DA`} cls="kpi-a" />
        <KpiTile label={`Anomalies (${CURRENT_MONTH})`} value={rows.filter((r: any) => r.verdict === 'anomalie').length} cls="kpi-r" />
        <KpiTile label="Relevés incomplets" value={rows.filter((r: any) => r.verdict === 'incomplet').length} cls="kpi-t" />
      </div>
      <Charts>
        <ChartCard title="Consommation réelle vs norme" sub={`Mois ${CURRENT_MONTH} — L/100 km (ou L/h engins)`}>
          <BarChart
            labels={withNorm.map((r: any) => r.vehicleCode)}
            datasets={[
              { label: 'Réel', values: withNorm.map((r: any) => r.consoReelle ?? 0), colorVar: '--c2' },
              { label: 'Norme', values: withNorm.map((r: any) => r.norme ?? 0), colorVar: '--c3' },
            ]}
            unit="" height={230}
          />
        </ChartCard>
        <ChartCard title="Km hors missions validées" sub="Véhicules à contrôle par mission — usage à vérifier">
          <Bars data={horsMission.map((r: any) => ({ label: r.vehicleCode, value: r.kmNonJustifie ?? 0 }))} unit=" km" colorVar="--c4" />
        </ChartCard>
      </Charts>
      <Table exportName="rapport-carburant" head={['Véhicule', 'Contrôle', 'Km/h fait', 'Km hors mission', 'Litres nets', 'Conso réelle', 'Norme', 'Écart', 'Verdict']}
        rows={rows.length ? rows.map((r: any) => {
          const engin = r.method === 'heures_engin';
          return [
            `${r.vehicleCode} — ${r.label}`,
            CTRL_METHOD_SHORT[r.controlMethod] ?? r.controlMethod,
            engin ? (r.hoursFait != null ? `${fk(r.hoursFait)} h` : '—') : (r.kmFait != null ? `${fk(r.kmFait)} km` : '—'),
            r.kmNonJustifie ? `${fk(r.kmNonJustifie)} km` : '—',
            `${fk(r.litresNets)} L`,
            r.consoReelle != null ? `${r.consoReelle} ${engin ? 'L/h' : 'L/100'}` : '—',
            r.norme != null ? `${r.norme}` : '—',
            r.ecartPct != null ? `${r.ecartPct > 0 ? '+' : ''}${r.ecartPct}%` : '—',
            <span key="v" style={{ color: V_COLOR[r.verdict], fontWeight: 700 }}>{V_LBL[r.verdict] ?? r.verdict}</span>,
          ];
        }) : V.filter((x) => (x.normOff ?? 0) > 0).map((x) => {
          const km = vhMissionKm(x.code, MI);
          const l = FU.filter((f) => f.vehicleCode === x.code).reduce((s, f) => s + (f.qty ?? 0), 0);
          return [`${x.code} — ${x.brand}`, '—', fk(km) + ' km', '—', `${l} L`, km > 0 ? `${((l / km) * 100).toFixed(1)} L/100` : '—', `${x.normCorr ?? '—'}`, '—', '—'];
        })} />
      <div style={{ fontSize: '.7rem', color: 'var(--tm)', marginTop: 6 }}>
        Chiffres identiques au module <b>Carburant → Contrôle</b> pour {CURRENT_MONTH}. Le « Km/h fait »
        vient du relevé début→fin pour les véhicules contrôlés par différence de km (Audi, voitures de
        service…), des missions pour les véhicules à contrôle mission, des heures pour les engins.
      </div>
    </>
  );
}

function FraisReport({ MI, V, B, drName }: { MI: import('@/lib/types').Mission[]; V: import('@/lib/types').Vehicle[]; B?: BaremeMission; drName: (c: string | null) => string }) {
  const rows = useMemo(() => {
    if (!B) return [];
    return MI.filter((m) => m.status !== 'PLANIFIEE').map((m) => ({ m, f: calcFraisMission(m, B, V) }));
  }, [MI, V, B]);
  const total = rows.reduce((s, r) => s + r.f.total, 0);
  const confirmed = rows.filter((r) => r.f.confirmed).reduce((s, r) => s + r.f.total, 0);
  return (
    <>
      <ReportInsights series={[
        { label: 'Frais de mission', unit: 'DA', points: rows.map(({ m, f }) => ({ date: m.dateStart, value: f.total })) },
      ]} />
      <div className="rap-kpi-row">
        <KpiTile label="Total Frais" value={`${fk(Math.round(total))} DA`} cls="kpi-b" />
        <KpiTile label="Confirmés" value={`${fk(Math.round(confirmed))} DA`} cls="kpi-g" />
        <KpiTile label="En Simulation" value={`${fk(Math.round(total - confirmed))} DA`} cls="kpi-a" />
        <KpiTile label="Missions" value={rows.length} cls="kpi-t" />
      </div>
      <Charts>
        <ChartCard title="Frais par chauffeur">
          <Bars data={(() => { const m: Record<string, number> = {}; rows.forEach(({ m: mi, f }) => { const k = drName(mi.driverCode); m[k] = (m[k] ?? 0) + f.total; }); return Object.entries(m).map(([k, v]) => ({ label: k.split(' ')[0], value: v })); })()} unit=" DA" colorVar="--c1" />
        </ChartCard>
        <ChartCard title="Confirmés vs simulation">
          <DonutChart data={[{ label: 'Confirmés', value: Math.round(confirmed), colorVar: '--c3' }, { label: 'Simulation', value: Math.round(total - confirmed), colorVar: '--c4' }]} centerUnit="DA" />
        </ChartCard>
      </Charts>
      <Table exportName="rapport-frais" head={['Mission', 'Chauffeur', 'Trajet', 'Cat.', 'Zone', 'Montant', 'Statut']}
        rows={rows.map(({ m, f }) => [m.num, drName(m.driverCode), `${m.fromLoc} → ${m.toLoc}`, f.cat, f.zoneBareme, `${fk(f.total)} DA`, f.confirmed ? <span key="s" className="bg bg-g">CONFIRMÉ</span> : <span key="s" className="bg bg-a">SIMULATION</span>])} />
    </>
  );
}

function KmReport({ V, MI }: { V: import('@/lib/types').Vehicle[]; MI: import('@/lib/types').Mission[] }) {
  const fc = useFuelControlMonth(CURRENT_MONTH);
  const byCode = new Map((fc.data ?? []).map((r: any) => [r.vehicleCode, r]));
  const totalKm = MI.reduce((s, m) => s + (m.distance ?? 0), 0);
  const kmFaitMois = (fc.data ?? []).reduce((s: number, r: any) => s + (r.kmFait ?? 0), 0);
  const relevesManquants = (fc.data ?? []).filter((r: any) => !r.readingComplete).length;
  return (
    <>
      <ReportInsights series={[
        { label: 'Km missions', unit: 'km', points: MI.map((m) => ({ date: m.dateStart, value: m.distance ?? 0 })) },
      ]} />
      <div className="rap-kpi-row">
        <KpiTile label={`Km fait (${CURRENT_MONTH})`} value={fk(Math.round(kmFaitMois))} cls="kpi-b" />
        <KpiTile label="Km Total Missions" value={fk(totalKm)} cls="kpi-t" />
        <KpiTile label="Km Compteur Flotte" value={fk(V.reduce((s, x) => s + (x.km ?? 0), 0))} cls="kpi-g" />
        <KpiTile label="Relevés début/fin manquants" value={relevesManquants} cls="kpi-a" />
      </div>
      <Charts>
        <ChartCard title="Km compteur vs km missions" sub="Par véhicule">
          <BarChart
            labels={V.map((x) => x.code)}
            datasets={[
              { label: 'Compteur', values: V.map((x) => x.km ?? 0), colorVar: '--c1' },
              { label: 'Missions', values: V.map((x) => vhMissionKm(x.code, MI)), colorVar: '--c2' },
            ]}
            unit=" km" height={240}
          />
        </ChartCard>
      </Charts>
      <Table exportName="rapport-kilometrage" head={['Véhicule', 'Km Compteur', `Relevé début→fin (${CURRENT_MONTH})`, 'Km fait', 'Km Missions', 'Km hors mission']}
        rows={V.map((x) => {
          const r: any = byCode.get(x.code);
          const rel = r?.reading && r.reading.kmStart != null && r.reading.kmEnd != null
            ? `${fk(r.reading.kmStart)} → ${fk(r.reading.kmEnd)}`
            : (r && !r.readingComplete ? <span key="m" style={{ color: 'var(--a6)' }}>à relever</span> : '—');
          return [
            `${x.code} — ${x.brand} ${x.model}`,
            fk(x.km),
            rel,
            r?.kmFait != null ? fk(r.kmFait) : (r?.hoursFait != null ? `${fk(r.hoursFait)} h` : '—'),
            fk(vhMissionKm(x.code, MI)),
            r?.kmNonJustifie ? <span key="h" style={{ color: 'var(--a6)', fontWeight: 600 }}>{fk(r.kmNonJustifie)} km</span> : '—',
          ];
        })} />
    </>
  );
}

function AlertesReport({ AL }: { AL: import('@/lib/types').Alert[] }) {
  return (
    <>
      <div className="rap-kpi-row">
        <KpiTile label="Total Alertes" value={AL.length} cls="kpi-b" />
        <KpiTile label="Critiques" value={AL.filter((a) => a.priority === 'CRITIQUE').length} cls="kpi-r" />
        <KpiTile label="Hautes" value={AL.filter((a) => a.priority === 'HAUTE').length} cls="kpi-a" />
        <KpiTile label="Autres" value={AL.filter((a) => a.priority !== 'CRITIQUE' && a.priority !== 'HAUTE').length} cls="kpi-t" />
      </div>
      <Charts>
        <ChartCard title="Alertes par priorité">
          <DonutChart data={[...new Set(AL.map((a) => a.priority))].map((p, i) => ({ label: String(p), value: AL.filter((a) => a.priority === p).length, colorVar: CC[i % 4] }))} centerUnit="alertes" />
        </ChartCard>
        <ChartCard title="Alertes par catégorie">
          <Bars data={[...new Set(AL.map((a) => a.category ?? '—'))].map((c) => ({ label: String(c), value: AL.filter((a) => (a.category ?? '—') === c).length }))} colorVar="--c4" />
        </ChartCard>
      </Charts>
      <Table exportName="rapport-alertes" head={['Titre', 'Description', 'Catégorie', 'Priorité', 'Quand']}
        rows={AL.map((a) => [a.title, a.description, a.category?.toUpperCase(), <StatusBadge key="p" status={a.priority} />, a.timeLabel])} />
    </>
  );
}

// ══════════ CONSTRUCTEUR DE RAPPORT ══════════
type FieldDef = { label: string; get: (r: any, ctx: BuilderCtx) => string | number };
interface BuilderCtx { drName: (c: string | null) => string; MI: Mission[] }

const RB: Record<string, { rows: (ctx: BuilderCtx & { V: Vehicle[]; D: Driver[]; MT: MaintenanceOrder[]; FU: FuelEntry[]; AL: Alert[] }) => any[]; fields: Record<string, FieldDef['get']> }> = {
  Flotte: {
    rows: ({ V }) => V,
    fields: {
      'Code': (v) => v.code, 'Marque': (v) => v.brand, 'Modèle': (v) => v.model, 'Type': (v) => v.type,
      'Immatriculation': (v) => v.plate ?? '', 'Statut': (v) => v.status, 'Kilométrage': (v) => v.km ?? 0,
      'Carburant': (v) => v.fuel ?? '', 'Propriété': (v) => v.ownership, 'Norme L/100': (v) => v.normOff ?? 0,
      'Norme Corrigée': (v) => v.normCorr ?? 0, 'Date CT': (v) => v.ctDate ?? '', 'Statut CT': (v) => v.ctStatus ?? '',
      'Date Assurance': (v) => v.insDate ?? '', 'Statut Assurance': (v) => v.insStatus ?? '',
    },
  },
  Chauffeurs: {
    rows: ({ D }) => D,
    fields: {
      'N° Employé': (d) => d.code, 'Nom': (d) => d.name, 'Permis': (d) => d.license, 'Exp. Permis': (d) => d.licenseExpiry ?? '',
      'Statut': (d) => d.status, 'Véhicule Affecté': (d) => d.vehicleCode ?? '', 'Heures/Semaine': (d) => d.hoursWeek ?? 0,
      'Heures/Mois': (d) => d.hoursMonth ?? 0, 'Fatigue %': (d) => Math.round((d.fatigue ?? 0) * 100),
      'Téléphone': (d) => d.phone ?? '', 'Qualifications': (d) => (d.quals ?? []).join(', '),
    },
  },
  Missions: {
    rows: ({ MI }) => MI,
    fields: {
      'N° Mission': (m) => m.num, 'Départ': (m) => m.fromLoc, 'Arrivée': (m) => m.toLoc, 'Date Départ': (m) => fd(m.dateStart),
      'Date Fin': (m) => fd(m.dateEnd), 'Distance': (m) => m.distance ?? 0, 'Zone': (m) => m.zone ?? '',
      'Chauffeur': (m, ctx) => ctx.drName(m.driverCode), 'Véhicule': (m) => m.vehicleCode ?? '', 'Statut': (m) => m.status,
      'Multipoint': (m) => ((m.waypoints?.length ?? 0) > 0 ? 'Oui' : 'Non'), 'Nb Étapes': (m) => m.waypoints?.length ?? 0,
    },
  },
  Maintenance: {
    rows: ({ MT }) => MT,
    fields: {
      'N° OT': (o) => o.num, 'Véhicule': (o) => o.vehicleCode, 'Type': (o) => o.type, 'Titre': (o) => o.title,
      'Priorité': (o) => o.priority, 'Statut': (o) => o.status, 'Pièces DA': (o) => o.partsCost ?? 0,
      'M.O. DA': (o) => o.laborCost ?? 0, 'Coût Total DA': (o) => o.totalCost ?? 0, 'Date': (o) => o.date ?? '',
    },
  },
  Carburant: {
    rows: ({ FU }) => FU,
    fields: {
      'Date': (f) => f.date, 'Véhicule': (f) => f.vehicleCode, 'Chauffeur': (f, ctx) => ctx.drName(f.driverCode),
      'Type': (f) => f.fuelType, 'Quantité L': (f) => f.qty, 'Prix Unit.': (f) => f.unitPrice,
      'Montant': (f) => Math.round(f.qty * f.unitPrice), 'Norme': (f) => f.norm ?? 0,
    },
  },
  Alertes: {
    rows: ({ AL }) => AL,
    fields: {
      'Titre': (a) => a.title, 'Description': (a) => a.description ?? '', 'Catégorie': (a) => a.category ?? '',
      'Priorité': (a) => a.priority, 'Type': (a) => a.type ?? '', 'Date': (a) => a.timeLabel ?? '',
    },
  },
};

function ReportBuilder(props: { V: Vehicle[]; D: Driver[]; MI: Mission[]; MT: MaintenanceOrder[]; FU: FuelEntry[]; AL: Alert[]; drName: (c: string | null) => string }) {
  const [cat, setCat] = useState<keyof typeof RB>('Flotte');
  const [selected, setSelected] = useState<string[]>([]);
  const def = RB[cat];
  const ctx: BuilderCtx = { drName: props.drName, MI: props.MI };
  const rows = def.rows(props as never);
  const cols = selected.length ? selected : Object.keys(def.fields);
  const data = rows.map((r) => cols.map((c) => def.fields[c](r, ctx)));

  return (
    <>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <select value={cat} onChange={(e) => { setCat(e.target.value as keyof typeof RB); setSelected([]); }}>
          {Object.keys(RB).map((c) => <option key={c}>{c}</option>)}
        </select>
        <span style={{ fontSize: '.72rem', color: 'var(--tm)' }}>Cliquez sur les champs à inclure (aucun = tous)</span>
        <div style={{ flex: 1 }} />
        <button className="btn btn-p btn-sm" onClick={() => downloadCSV(`rapport-${cat.toLowerCase()}`, cols, data)}>Export CSV</button>
        <button className="btn btn-o btn-sm" onClick={() => downloadCSV(`rapport-${cat.toLowerCase()}`, cols, data)}>Imprimer</button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {Object.keys(def.fields).map((f) => (
          <button key={f} className={`fc${selected.includes(f) ? ' act' : ''}`}
            onClick={() => setSelected((s) => (s.includes(f) ? s.filter((x) => x !== f) : [...s, f]))}>{f}</button>
        ))}
      </div>
      <div className="tc"><div className="tw"><table>
        <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{data.slice(0, 200).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{String(c)}</td>)}</tr>)}</tbody>
      </table></div></div>
      <div style={{ fontSize: '.72rem', color: 'var(--tm)', marginTop: 6 }}>{data.length} ligne(s)</div>
    </>
  );
}
