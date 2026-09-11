'use client';

import { icons } from '@/components/ui/icons';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  useConfig, useConfirmedRemove, useCreate, useMaintenanceDue, useMaintenanceFlags, useMaintenanceKpis,
  useMaintenanceOrders, useMaintenancePlans, useMoveTire, useOtStatus, useSuppliers, useTireInventory,
  useTireMovements, useTires, useUpdate, useVehicles,
} from '@/lib/api/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import Tabs from '@/components/ui/Tabs';
import StatusBadge from '@/components/ui/StatusBadge';
import Modal from '@/components/ui/Modal';
import PeriodPicker from '@/components/ui/PeriodPicker';
import SearchBox from '@/components/ui/SearchBox';
import DateInput from '@/components/ui/DateInput';
import { useSearch } from '@/lib/useSearch';
import BarChart from '@/components/charts/BarChart';
import DonutChart from '@/components/charts/DonutChart';
import { usePeriod } from '@/lib/period';
import { fd, fk } from '@/lib/fleet/format';
import { downloadCSV, printHTML } from '@/lib/export';
import { positionsFor } from '@/lib/reference/tirePositions';
import { normalizeVehicleLists, type VehicleLists } from '@/lib/reference/vehicleLists';
import type { MaintenanceOrder, Vehicle } from '@/lib/types';

const OT_STATUSES = ['ouvert', 'diagnostic', 'valide', 'en_lancement', 'termine', 'annule'];
const OT_LABEL: Record<string, string> = {
  ouvert: 'Ouvert', diagnostic: 'Diagnostic', valide: 'Validé', en_lancement: 'En lancement', termine: 'Terminé', annule: 'Annulé',
};
const WORK_TYPES = ['Vidange huile moteur', 'Remplacement filtre huile', 'Remplacement filtre air', 'Contrôle plaquettes frein', 'Remplacement plaquettes', 'Contrôle disques frein', 'Purge liquide frein', 'Remplacement courroie distribution', 'Contrôle courroie accessoires', 'Contrôle batterie', 'Remplacement pneumatiques', 'Alignement géométrie', 'Contrôle climatisation', 'Graissage', 'Lavage complet'];

function printOT(o: MaintenanceOrder, vLabel: (c: string) => string) {
  const ops = (o.operations ?? []).map((op: { desc?: string; label?: string; duree?: string; tech?: string; statut?: string }) =>
    `<tr><td>${op.desc ?? op.label ?? ''}</td><td>${op.duree ?? '—'}</td><td>${op.tech ?? '—'}</td><td>${op.statut ?? '—'}</td></tr>`).join('');
  printHTML(`OT ${o.num}`, `
    <h1>Ordre de Travail ${o.num}</h1>
    <table class="info">
      <tr><td>Véhicule</td><td>${vLabel(o.vehicleCode ?? '')}</td></tr>
      <tr><td>Type</td><td>${o.type}</td></tr>
      <tr><td>Titre</td><td>${o.title}</td></tr>
      <tr><td>Priorité</td><td>${o.priority}</td></tr>
      <tr><td>Statut</td><td>${OT_LABEL[o.status ?? ''] ?? o.status}</td></tr>
      <tr><td>N° commande</td><td>${(o as { cmd?: string }).cmd ?? '—'}</td></tr>
      <tr><td>Date</td><td>${fd(o.date)}</td></tr>
      <tr><td>Coût pièces</td><td>${fk(o.partsCost)} DA</td></tr>
      <tr><td>Coût main d'œuvre</td><td>${fk(o.laborCost)} DA</td></tr>
      <tr><td>Coût total</td><td><b>${fk(o.totalCost)} DA</b></td></tr>
    </table>
    ${ops ? `<h2>Opérations</h2><table><thead><tr><th>Opération</th><th>Durée</th><th>Technicien</th><th>Statut</th></tr></thead><tbody>${ops}</tbody></table>` : ''}`);
}

export default function MaintenancePage() {
  const [tab, setTab] = useState(0);
  const period = usePeriod();
  const [vhFilter, setVhFilter] = useState('all');
  const [detail, setDetail] = useState<MaintenanceOrder | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [workVh, setWorkVh] = useState<string[]>([]);
  const [workTypes, setWorkTypes] = useState<string[]>([]);
  const [workOpen, setWorkOpen] = useState(false);
  const [planModal, setPlanModal] = useState<Record<string, unknown> | null | undefined>(undefined);
  const [tireModal, setTireModal] = useState<'new' | { id: string; ref: string } | null>(null);

  const mt = useMaintenanceOrders();
  const vehicles = useVehicles();
  const suppliers = useSuppliers();
  const plans = useMaintenancePlans();
  const due = useMaintenanceDue();
  const flags = useMaintenanceFlags();
  const from = period.mode === 'cumul' ? undefined : `${period.month}-01`;
  const to = period.mode === 'cumul' ? undefined : `${period.month}-31`;
  const kpis = useMaintenanceKpis(from, to);
  const tires = useTires();
  const inventory = useTireInventory();
  const createOT = useCreate<MaintenanceOrder>('maintenance-orders');
  const otStatus = useOtStatus();
  const removePlan = useConfirmedRemove('maintenance-plans', 'ce modèle');
  const removeOT = useConfirmedRemove('maintenance-orders', 'cet OT');

  const MT = (mt.data ?? []) as MaintenanceOrder[];
  const V = vehicles.data ?? [];
  const vLabel = (c: string) => { const v = V.find((x) => x.code === c); return v ? `${c} — ${v.brand} ${v.model}` : c; };

  const MTp = MT.filter((o) => period.matches(o.date));
  const otVehicles = [...new Set(MT.map((o) => o.vehicleCode))].filter(Boolean).sort();
  const otSearch = useSearch(MT, (o) => [o.num, o.vehicleCode, o.type, o.title, o.status, o.priority, (o as { cmd?: string }).cmd].join(' '));
  const filteredOT = (vhFilter === 'all' ? otSearch.filtered : otSearch.filtered.filter((o) => o.vehicleCode === vhFilter))
    .slice()
    .sort((a, b) => OT_STATUSES.indexOf(a.status ?? 'ouvert') - OT_STATUSES.indexOf(b.status ?? 'ouvert'));

  const genWorkOT = async () => {
    if (!workVh.length) { toast.error('Sélectionnez au moins un véhicule'); return; }
    if (!workTypes.length) { toast.error('Sélectionnez au moins un travail'); return; }
    const ti = workTypes.length > 2 ? `${workTypes.slice(0, 2).join(', ')} +${workTypes.length - 2}` : workTypes.join(', ');
    let lastN = Math.max(0, ...MT.map((o) => parseInt(o.num.split('-')[1] || '0')));
    for (const vh of workVh) {
      lastN++;
      await createOT.mutateAsync({
        num: `OT-${String(lastN).padStart(4, '0')}`, vehicleCode: vh, type: 'PERIODIQUE', title: ti,
        priority: 'MOYENNE', status: 'ouvert', partsCost: 0, laborCost: 0, totalCost: 0,
        date: new Date().toLocaleDateString('fr-FR'), operations: workTypes.map((w) => ({ desc: w, duree: '', tech: '', statut: 'A_FAIRE' })),
      });
    }
    toast.success(`${workVh.length} OT générés`);
    setWorkVh([]); setWorkTypes([]); setTab(0);
  };

  const openOtFromDue = async (d: { vehicleCode: string; planId?: string; planName: string; operations: { label: string }[]; hasOpenOt?: boolean; openOtNum?: string | null }) => {
    if (d.hasOpenOt) {
      toast(`Un OT est déjà ouvert pour ${d.vehicleCode} — ${d.planName}${d.openOtNum ? ` (${d.openOtNum})` : ''}`);
      setTab(0);
      return;
    }
    const lastN = Math.max(0, ...MT.map((o) => parseInt(o.num.split('-')[1] || '0')));
    await createOT.mutateAsync({
      num: `OT-${String(lastN + 1).padStart(4, '0')}`, vehicleCode: d.vehicleCode, type: 'PERIODIQUE',
      planId: d.planId ?? null,
      title: d.planName, priority: 'HAUTE', status: 'ouvert', partsCost: 0, laborCost: 0, totalCost: 0,
      date: new Date().toLocaleDateString('fr-FR'),
      operations: d.operations.map((op) => ({ desc: op.label, duree: '', tech: '', statut: 'A_FAIRE' })),
    });
    toast.success(`OT ouvert pour ${d.vehicleCode} — ${d.planName}`);
    setTab(0);
  };

  const K = kpis.data as any;

  return (
    <div className="page active">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <div className="sg sg3" style={{ flex: 1, minWidth: 0, margin: 0 }}>
          <div className="sc"><div><div className="sv">{K?.otCountPeriod ?? MTp.length}</div><div className="sl">OT — {period.label}</div><div className="st">{K?.prevPeriod ?? 0} prév. · {K?.curPeriod ?? 0} curatifs</div></div><div className="si bl">{icons.wrench}</div></div>
          <div className="sc"><div><div className="sv">{fk(Math.round((K?.costPeriod ?? 0) / 1000))}K</div><div className="sl">Coût — {period.label}</div><div className="st dn">Pièces + M.O.</div></div><div className="si am">{icons.dollar}</div></div>
          <div className="sc"><div><div className="sv">{K?.breakdownHoursPeriod ?? 0}h</div><div className="sl">Heures de panne</div><div className="st dn">{K?.mostStopped ? `${K.mostStopped.code} (${K.mostStopped.hours}h)` : '—'}</div></div><div className="si rd">{icons.alert}</div></div>
        </div>
        <PeriodPicker period={period} />
      </div>

      {(flags.data ?? []).length > 0 && (
        <div style={{ marginBottom: 10, padding: '8px 12px', background: 'var(--a1)', border: '1px solid var(--a5)', borderRadius: 'var(--rs)', fontSize: '.72rem', color: 'var(--a6)' }}>
          <b>{(flags.data ?? []).length} alerte(s) anti-redondance :</b>{' '}
          {(flags.data ?? []).slice(0, 3).map((f: any) => f.message).join(' · ')}
        </div>
      )}

      <Tabs
        tabs={['Ordres de Travail', 'Modèles préventifs', 'Échéances', 'Pneumatiques', 'Statistiques', 'Coûts', 'Performance', 'Rapports']}
        active={tab} onChange={setTab}
      />

      {/* ── OT ── */}
      {tab === 0 && (
        <div className="tpane act">
          <div className="tc">
            <div className="th">
              <h3>Ordres de Travail</h3>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <select value={vhFilter} onChange={(e) => setVhFilter(e.target.value)} style={{ fontSize: '.75rem', padding: '4px 8px', border: '1px solid var(--bd)', borderRadius: 'var(--rs)', background: 'var(--s1)', color: 'var(--tp)' }}>
                  <option value="all">Tous les véhicules</option>
                  {otVehicles.map((c) => <option key={c}>{c}</option>)}
                </select>
                <button className="btn btn-o btn-sm" onClick={() => downloadCSV('ordres-travail', ['N°', 'Véhicule', 'Type', 'Titre', 'Statut', 'Priorité', 'Coût', 'Date'], filteredOT.map((o) => [o.num, o.vehicleCode ?? '', o.type ?? '', o.title ?? '', OT_LABEL[o.status ?? ''] ?? o.status ?? '', o.priority ?? '', o.totalCost ?? 0, o.date ?? '']))}>CSV</button>
                <SearchBox value={otSearch.q} onChange={otSearch.setQ} placeholder="N° OT, véhicule, titre, statut…" count={filteredOT.length} total={MT.length} />
                <button className="btn btn-o btn-sm" onClick={() => setWorkOpen(true)}>OT groupés</button>
                <button className="btn btn-p" onClick={() => setAddOpen(true)}>+ Nouvel OT</button>
              </div>
            </div>
            <div className="tw">
              <table>
                <thead><tr><th>N° OT</th><th>Véhicule</th><th>Titre</th><th>Fournisseur</th><th>Prio. / Statut</th><th>Coût</th><th>Actions</th></tr></thead>
                <tbody>
                  {filteredOT.map((o) => (
                    <tr key={o.num} className="clickable" onClick={() => setDetail(o)}>
                      <td>{o.num}<div style={{ fontSize: '.6rem', color: 'var(--tm)', fontWeight: 400 }}>{fd(o.date)}</div></td>
                      <td>{o.vehicleCode}</td>
                      <td title={o.title ?? ''}><span className={`bg ${o.type === 'PERIODIQUE' ? 'bg-b' : 'bg-r'}`} style={{ fontSize: '.55rem', marginRight: 4 }}>{o.type === 'PERIODIQUE' ? 'PRÉV.' : 'CUR.'}</span>{o.title}</td>
                      <td style={{ fontSize: '.72rem' }} title={suppliers.data?.find((s) => s.code === o.supplierCode)?.name ?? ''}>{suppliers.data?.find((s) => s.code === o.supplierCode)?.name ?? '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}><StatusBadge status={o.priority} /> <span className="bg bg-t" style={{ fontSize: '.55rem' }}>{OT_LABEL[o.status ?? ''] ?? o.status}</span></td>
                      <td style={{ fontWeight: 600 }}>{fk(o.totalCost)} DA</td>
                      <td onClick={(e) => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn btn-o btn-sm" onClick={() => printOT(o, vLabel)}>Imprimer</button>{' '}
                        <button className="btn btn-r btn-sm" onClick={() => removeOT(o.num, o.num)}>Suppr.</button>
                      </td>
                    </tr>
                  ))}
                  {!filteredOT.length && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--tm)', padding: 16 }}>Aucun OT ne correspond{otSearch.q ? ` à « ${otSearch.q} »` : ''}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Modèles préventifs ── */}
      {tab === 1 && (
        <div className="tpane act">
          <div className="tc">
            <div className="th"><h3>Modèles d&apos;Entretien Préventif</h3><div><button className="btn btn-p btn-sm" onClick={() => setPlanModal(null)}>+ Nouveau modèle</button></div></div>
            <div className="tw">
              <table>
                <thead><tr><th>Nom</th><th>Cible</th><th>Déclencheur</th><th>Intervalle</th><th>Opérations</th><th>Coût estimé</th><th>Seuil alerte</th><th>Actions</th></tr></thead>
                <tbody>
                  {(plans.data ?? []).map((p: any) => (
                    <tr key={p.id} className="clickable" onClick={() => setPlanModal(p)}>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td>{p.targetKind === 'vehicles' ? (p.targetVehicles ?? []).join(', ') : `${p.targetKind}: ${p.targetValue}`}</td>
                      <td><span className="bg bg-b">{p.trigger}</span></td>
                      <td>{fk(p.intervalValue)} {p.trigger === 'HOURS' ? 'h' : 'km'}</td>
                      <td style={{ fontSize: '.72rem' }}>{(p.operations ?? []).map((o: any) => o.label).join(', ')}</td>
                      <td style={{ fontWeight: 600 }}>{fk((p.operations ?? []).reduce((s: number, o: any) => s + (o.coutEstime ?? 0), 0))} DA</td>
                      <td>{p.alertThresholdPct}%</td>
                      <td onClick={(e) => e.stopPropagation()}><button className="btn btn-r btn-sm" onClick={() => removePlan(p.id, p.name)}>Suppr.</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Échéances ── */}
      {tab === 2 && (
        <div className="tpane act">
          <div className="sub" style={{ marginBottom: 10 }}>
            Échéances <b>calculées</b> à partir des <b>modèles préventifs</b> et du compteur (km / heures) de chaque véhicule —
            ce ne sont pas des ordres de travail. Cliquer <b>« Ouvrir OT »</b> crée l&apos;ordre de travail correspondant ;
            l&apos;échéance passe alors dans <b>« Pris en charge »</b> et n&apos;est plus réclamée tant que l&apos;OT n&apos;est pas terminé.
          </div>
          {[
            { label: 'En retard', pick: (d: any) => !d.hasOpenOt && d.overdue },
            { label: 'À prévoir (proche)', pick: (d: any) => !d.hasOpenOt && d.alert && !d.overdue },
            { label: 'À venir', pick: (d: any) => !d.hasOpenOt && !d.alert && !d.overdue },
            { label: 'Pris en charge (OT ouvert)', pick: (d: any) => d.hasOpenOt },
          ].map(({ label, pick }) => {
            const items = (due.data ?? []).filter(pick);
            if (!items.length) return null;
            const done = label.startsWith('Pris en charge');
            return (
              <div className="tc" key={label} style={{ marginBottom: 10, opacity: done ? 0.85 : 1 }}>
                <div className="th"><h3>{label} ({items.length})</h3></div>
                <div className="tw">
                  <table>
                    <thead><tr><th>Véhicule</th><th>Modèle</th><th>Actuel</th><th>Échéance</th><th>Restant</th><th>Coût estimé</th><th>Action</th></tr></thead>
                    <tbody>
                      {items.map((d: any, i: number) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>{d.vehicleLabel}</td><td>{d.planName}</td>
                          <td>{fk(d.current)} {d.trigger === 'HOURS' ? 'h' : 'km'}</td>
                          <td>{fk(d.nextDue)}</td>
                          <td style={{ fontWeight: 600, color: d.overdue ? 'var(--r6)' : d.alert ? 'var(--a6)' : 'var(--g6)' }}>
                            {d.overdue ? `−${fk(Math.abs(d.remaining))}` : fk(d.remaining)} {d.trigger === 'HOURS' ? 'h' : 'km'}
                          </td>
                          <td>{fk(d.estimatedCost)} DA</td>
                          <td>
                            {d.hasOpenOt
                              ? <button className="btn btn-o btn-sm" onClick={() => setTab(0)} title="Voir l'ordre de travail">{d.openOtNum ?? 'OT'} en cours →</button>
                              : <button className="btn btn-p btn-sm" onClick={() => openOtFromDue(d)}>Ouvrir OT</button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
          {!(due.data ?? []).some((d: any) => !d.hasOpenOt && (d.alert || d.overdue)) && (
            <div className="cc" style={{ padding: 24, color: 'var(--tm)' }}>Aucune échéance proche à traiter. {(due.data ?? []).length} suivi(s) actif(s).</div>
          )}
        </div>
      )}

      {/* ── Pneumatiques ── */}
      {tab === 3 && (
        <TiresTab
          tires={tires.data ?? []} inventory={inventory.data} vehicles={V}
          onNew={() => setTireModal('new')} onMove={(id, ref) => setTireModal({ id, ref })}
        />
      )}

      {/* ── Statistiques (KPI) ── */}
      {tab === 4 && K && (
        <div className="tpane act">
          <div className="maint-stat-grid">
            {([
              ['OT — période', K.otCountPeriod], ['OT — cumul', K.otCountCumul],
              ['Préventif période', `${K.prevPeriod} / ${K.prevCumul} cumul`],
              ['Curatif période', `${K.curPeriod} / ${K.curCumul} cumul`],
              ['Taux préventif réalisé', `${K.tauxPreventifRealise}%`],
              ['Taux de pannes', `${K.tauxPannes}%`],
              ['Heures panne période', `${K.breakdownHoursPeriod}h`],
              ['Heures panne cumul', `${K.breakdownHoursCumul}h`],
              ['Véhicule le + d’OT', K.topVehicleOT ? `${K.topVehicleOT.code} (${K.topVehicleOT.count})` : '—'],
              ['Véhicule le + à l’arrêt', K.mostStopped ? `${K.mostStopped.code} (${K.mostStopped.hours}h)` : '—'],
            ] as [string, React.ReactNode][]).map(([l, v]) => (
              <div className="maint-stat" key={l}><div className="sv">{v}</div><div className="sl">{l}</div></div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, margin: '14px 0' }}>
            <div className="cc">
              <h3>Préventif vs curatif</h3>
              <div className="sub">Sur la période</div>
              <div style={{ marginTop: 8 }}>
                <DonutChart data={[
                  { label: 'Préventif', value: K.prevPeriod ?? 0, colorVar: '--c3' },
                  { label: 'Curatif', value: K.curPeriod ?? 0, colorVar: '--c2' },
                ]} centerUnit="OT" />
              </div>
            </div>
            <div className="cc">
              <h3>Nombre d’OT par véhicule</h3>
              <div style={{ marginTop: 8 }}>
                <BarChart
                  labels={Object.keys(K.costByVehicle ?? {}).slice(0, 10)}
                  datasets={[{ label: 'OT', values: Object.keys(K.costByVehicle ?? {}).slice(0, 10).map((code) => MT.filter((o) => o.vehicleCode === code).length), colorVar: '--c1' }]}
                  height={230}
                />
              </div>
            </div>
          </div>
          <div className="tc">
            <div className="th"><h3>Historique Maintenance par Véhicule</h3></div>
            <div className="tw">
              <table>
                <thead><tr><th>Véhicule</th><th>Nb OT</th><th>Coût total</th></tr></thead>
                <tbody>
                  {Object.entries(K.costByVehicle ?? {}).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([code, c]) => (
                    <tr key={code}><td>{vLabel(code)}</td><td>{MT.filter((o) => o.vehicleCode === code).length}</td><td style={{ fontWeight: 600 }}>{fk(c as number)} DA</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Coûts ── */}
      {tab === 5 && K && (
        <div className="tpane act">
          <div className="rap-kpi-row">
            <div className="rap-kpi kpi-b"><div className="rap-kpi-label">Coût — {period.label}</div><div className="rap-kpi-val">{fk(K.costPeriod)} DA</div></div>
            <div className="rap-kpi kpi-a"><div className="rap-kpi-label">Coût cumulé</div><div className="rap-kpi-val">{fk(K.costCumul)} DA</div></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14, marginBottom: 14 }}>
            <div className="cc">
              <h3>Coût par type de véhicule</h3>
              <div style={{ marginTop: 8 }}>
                <DonutChart data={Object.entries(K.costByType ?? {}).map(([t, c], i) => ({ label: t, value: Math.round(c as number), colorVar: ['--c1', '--c2', '--c3', '--c4'][i % 4] }))} centerUnit="DA" />
              </div>
            </div>
            <div className="cc">
              <h3>Coût de maintenance par véhicule</h3>
              <div style={{ marginTop: 8 }}>
                <BarChart
                  labels={Object.entries(K.costByVehicle ?? {}).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 10).map(([code]) => code)}
                  datasets={[{ label: 'Coût', values: Object.entries(K.costByVehicle ?? {}).sort((a, b) => (b[1] as number) - (a[1] as number)).slice(0, 10).map(([, c]) => Math.round(c as number)), colorVar: '--c2' }]}
                  unit=" DA" height={240}
                />
              </div>
            </div>
          </div>
          <div className="cr">
            <div className="cc">
              <h3>Coût par Type de Véhicule</h3>
              <div className="tw"><table><thead><tr><th>Type</th><th>Coût</th></tr></thead><tbody>
                {Object.entries(K.costByType ?? {}).map(([t, c]) => <tr key={t}><td>{t}</td><td style={{ fontWeight: 600 }}>{fk(c as number)} DA</td></tr>)}
              </tbody></table></div>
            </div>
            <div className="cc">
              <h3>Coût par Véhicule</h3>
              <div className="tw"><table><thead><tr><th>Véhicule</th><th>Coût</th></tr></thead><tbody>
                {Object.entries(K.costByVehicle ?? {}).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([code, c]) => <tr key={code}><td>{code}</td><td style={{ fontWeight: 600 }}>{fk(c as number)} DA</td></tr>)}
              </tbody></table></div>
            </div>
          </div>
        </div>
      )}

      {/* ── Performance ── */}
      {tab === 6 && K && (
        <div className="tpane act">
          <div className="rap-kpi-row">
            <div className="rap-kpi kpi-g"><div className="rap-kpi-label">Entretiens à temps</div><div className="rap-kpi-val">{K.perf?.onTimePct ?? 0}%</div></div>
            <div className="rap-kpi kpi-r"><div className="rap-kpi-label">Entretiens en retard</div><div className="rap-kpi-val">{K.perf?.latePct ?? 0}%</div></div>
            <div className="rap-kpi kpi-a"><div className="rap-kpi-label">Taux de pannes</div><div className="rap-kpi-val">{K.tauxPannes}%</div></div>
            <div className="rap-kpi kpi-t"><div className="rap-kpi-label">Taux préventif réalisé</div><div className="rap-kpi-val">{K.tauxPreventifRealise}%</div></div>
          </div>
          <div className="cc" style={{ marginBottom: 14 }}>
            <h3>Indicateurs de performance</h3>
            <div style={{ marginTop: 8 }}>
              <BarChart
                labels={['À temps', 'En retard', 'Taux pannes', 'Préventif réalisé']}
                datasets={[{ label: '%', values: [K.perf?.onTimePct ?? 0, K.perf?.latePct ?? 0, K.tauxPannes ?? 0, K.tauxPreventifRealise ?? 0], colorVar: '--c1' }]}
                unit=" %" height={230}
              />
            </div>
          </div>
          <div className="tc">
            <div className="th"><h3>Répétition des pannes (anti-redondance)</h3></div>
            <div style={{ padding: 14 }}>
              {(flags.data ?? []).length ? (flags.data ?? []).map((f: any) => (
                <div key={f.id} style={{ fontSize: '.75rem', padding: '6px 8px', borderLeft: '3px solid var(--a5)', marginBottom: 4, background: 'var(--a0)' }}>
                  <b>{f.vehicleCode}</b> — {f.message} <span style={{ color: 'var(--tm)' }}>({new Date(f.createdAt).toLocaleDateString('fr-FR')})</span>
                </div>
              )) : <p style={{ fontSize: '.8rem', color: 'var(--tm)' }}>Aucune répétition détectée.</p>}
            </div>
          </div>
        </div>
      )}

      {/* ── Rapports ── */}
      {tab === 7 && K && (
        <div className="tpane act">
          <div className="cc" style={{ marginBottom: 14 }}>
            <h3>Top véhicules les plus coûteux</h3>
            <div style={{ marginTop: 8 }}>
              <BarChart
                labels={(K.topCostlyVehicles ?? []).slice(0, 10).map((t: any) => t.code)}
                datasets={[{ label: 'Coût', values: (K.topCostlyVehicles ?? []).slice(0, 10).map((t: any) => Math.round(t.cost)), colorVar: '--c2' }]}
                unit=" DA" height={240}
              />
            </div>
          </div>
          <div className="tc">
            <div className="th"><h3>Top véhicules les plus coûteux</h3><div><button className="btn btn-o btn-sm" onClick={() => downloadCSV('top-couteux', ['Rang', 'Véhicule', 'Coût'], (K.topCostlyVehicles ?? []).map((t: any, i: number) => [i + 1, t.code, t.cost]))}>CSV</button></div></div>
            <div className="tw">
              <table>
                <thead><tr><th>Rang</th><th>Véhicule</th><th>Coût maintenance</th><th>Nb OT</th></tr></thead>
                <tbody>
                  {(K.topCostlyVehicles ?? []).map((t: any, i: number) => (
                    <tr key={t.code}><td>{i + 1}</td><td style={{ fontWeight: 600 }}>{vLabel(t.code)}</td><td style={{ fontWeight: 600 }}>{fk(t.cost)} DA</td><td>{MT.filter((o) => o.vehicleCode === t.code).length}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `OT ${detail.num} — ${detail.title}` : ''} wide
        footer={detail && (
          <>
            <button className="btn btn-o" onClick={() => setDetail(null)}>Fermer</button>
            <button className="btn btn-o" onClick={() => printOT(detail, vLabel)}>Imprimer</button>
          </>
        )}>
        {detail && (
          <div>
            <div className="eval-grid" style={{ marginBottom: 12 }}>
              {([
                ['Véhicule', vLabel(detail.vehicleCode ?? '')], ['Type', detail.type],
                ['Priorité', <StatusBadge key="p" status={detail.priority} />],
                ['Pièces', `${fk(detail.partsCost)} DA`], ['M.O.', `${fk(detail.laborCost)} DA`],
                ['Total', `${fk(detail.totalCost)} DA`], ['Date', fd(detail.date)],
              ] as [string, React.ReactNode][]).map(([k, v]) => (
                <div className="eval-item" key={k}><div className="ev-label">{k}</div><div className="ev-val" style={{ fontSize: '.82rem' }}>{v}</div></div>
              ))}
            </div>
            <div style={{ marginBottom: 12 }}>
              <div className="ev-label" style={{ marginBottom: 6 }}>Statut</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {OT_STATUSES.map((s) => (
                  <button key={s} className={`fc${detail.status === s ? ' act' : ''}`}
                    onClick={async () => { await otStatus.mutateAsync({ num: detail.num, status: s }); setDetail({ ...detail, status: s }); toast.success(`OT → ${OT_LABEL[s]}`); }}>
                    {OT_LABEL[s]}
                  </button>
                ))}
              </div>
              {!!detail.statusHistory?.length && (
                <div style={{ marginTop: 8, fontSize: '.68rem', color: 'var(--tm)' }}>
                  {detail.statusHistory.map((h: { status: string; at: string; note?: string }, i: number) => (
                    <span key={i}>{OT_LABEL[h.status] ?? h.status} ({new Date(h.at).toLocaleString('fr-FR')}){i < detail.statusHistory!.length - 1 ? ' → ' : ''}</span>
                  ))}
                </div>
              )}
            </div>
            <AttachmentBox entityType="maintenance-order" entityId={detail.num} />
            {!!detail.operations?.length && (
              <div className="tw" style={{ marginTop: 12 }}>
                <table><thead><tr><th>Opération</th><th>Durée</th><th>Technicien</th><th>Statut</th></tr></thead>
                  <tbody>{detail.operations.map((op: { desc?: string; label?: string; duree?: string; tech?: string; statut?: string }, i: number) => (
                    <tr key={i}><td>{op.desc ?? op.label}</td><td>{op.duree || '—'}</td><td>{op.tech || '—'}</td><td>{op.statut ? <StatusBadge status={op.statut} /> : '—'}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>

      {addOpen && (
        <OTFormModal vehicles={V} suppliers={suppliers.data ?? []}
          nextNum={`OT-${String(Math.max(0, ...MT.map((o) => parseInt(o.num.split('-')[1] || '0'))) + 1).padStart(4, '0')}`}
          onClose={() => setAddOpen(false)}
          onSave={async (body) => { await createOT.mutateAsync(body); toast.success(`OT ${body.num} créé`); }} />
      )}

      {planModal !== undefined && (
        <PlanModal plan={planModal} vehicles={V} onClose={() => setPlanModal(undefined)} />
      )}

      {tireModal && (
        <TireModal data={tireModal} vehicles={V} onClose={() => setTireModal(null)} />
      )}

      {workOpen && (
        <Modal open onClose={() => setWorkOpen(false)} title="Générer des OT groupés" wide
          footer={<><button className="btn btn-o" onClick={() => setWorkOpen(false)}>Fermer</button><button className="btn btn-p" onClick={() => { genWorkOT(); setWorkOpen(false); }}>Générer {workVh.length} OT</button></>}>
          <div className="form-g"><label>Véhicules (clic multiple)</label>
            <div className="multi-vh-sel">
              {V.map((v) => (
                <label key={v.code} className={`multi-vh-chip${workVh.includes(v.code) ? ' sel' : ''}`}
                  onClick={() => setWorkVh(workVh.includes(v.code) ? workVh.filter((x) => x !== v.code) : [...workVh, v.code])}>
                  <input type="checkbox" readOnly checked={workVh.includes(v.code)} /><span>{v.code}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="form-g"><label>Travaux</label>
            <div className="work-sel">
              {WORK_TYPES.map((w) => (
                <label key={w} className="work-chk">
                  <input type="checkbox" checked={workTypes.includes(w)} onChange={() => setWorkTypes(workTypes.includes(w) ? workTypes.filter((x) => x !== w) : [...workTypes, w])} />
                  <span>{w}</span>
                </label>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ══════════ Sous-composants ══════════

function AttachmentBox({ entityType, entityId }: { entityType: string; entityId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const load = async () => {
    const { data } = await api.get('/attachments', { params: { entityType, entityId } });
    setItems(data); setLoaded(true);
  };
  if (!loaded) load();
  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.append('file', f);
    fd.append('entityType', entityType);
    fd.append('entityId', entityId);
    fd.append('kind', 'ot_justif');
    await api.post('/attachments', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    toast.success('Pièce jointe ajoutée');
    load();
  };
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="ev-label" style={{ marginBottom: 6 }}>Pièces jointes (bons de commande, justificatifs)</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {items.map((a) => (
          <a key={a.id} href={`${api.defaults.baseURL}/files/${a.id}`} target="_blank" rel="noreferrer" className="bg bg-b" style={{ fontSize: '.68rem' }}>
            {a.filename}
          </a>
        ))}
        <label className="btn btn-o btn-sm" style={{ cursor: 'pointer' }}>
          + Fichier<input type="file" style={{ display: 'none' }} onChange={upload} />
        </label>
      </div>
    </div>
  );
}

function OTFormModal({ vehicles, suppliers, nextNum, onClose, onSave }: {
  vehicles: Vehicle[]; suppliers: import('@/lib/types').Supplier[]; nextNum: string;
  onClose: () => void; onSave: (b: Partial<MaintenanceOrder>) => Promise<void>;
}) {
  const [f, setF] = useState<Partial<MaintenanceOrder>>({
    num: nextNum, vehicleCode: vehicles[0]?.code, type: 'PERIODIQUE', priority: 'MOYENNE', status: 'ouvert',
    partsCost: 0, laborCost: 0, totalCost: 0, date: new Date().toLocaleDateString('fr-FR'),
  });
  const set = (k: keyof MaintenanceOrder) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const submit = async () => {
    const miss = [!f.vehicleCode && 'véhicule', !f.title?.trim() && 'intitulé', !f.type && 'type', !f.date && 'date'].filter(Boolean);
    if (miss.length) { toast.error(`Champs obligatoires : ${miss.join(', ')}`); return; }
    const pi = Number(f.partsCost) || 0; const mo = Number(f.laborCost) || 0;
    await onSave({ ...f, partsCost: pi, laborCost: mo, totalCost: pi + mo, operations: [] });
    onClose();
  };
  return (
    <Modal open onClose={onClose} title="Nouvel Ordre de Travail"
      footer={<><button className="btn btn-o" onClick={onClose}>Annuler</button><button className="btn btn-p" onClick={submit}>Enregistrer</button></>}>
      <div className="form-r">
        <div className="form-g"><label>N° OT</label><input value={f.num ?? ''} readOnly /></div>
        <div className="form-g"><label>Véhicule</label><select value={f.vehicleCode ?? ''} onChange={set('vehicleCode')}>{vehicles.map((v) => <option key={v.code} value={v.code}>{v.code} — {v.brand} {v.model}</option>)}</select></div>
      </div>
      <div className="form-g"><label>Titre *</label><input value={f.title ?? ''} onChange={set('title')} /></div>
      <div className="form-r">
        <div className="form-g"><label>Type</label><select value={f.type ?? 'PERIODIQUE'} onChange={set('type')}><option>PERIODIQUE</option><option>CURATIVE</option></select></div>
        <div className="form-g"><label>Priorité</label><select value={f.priority ?? 'MOYENNE'} onChange={set('priority')}>{['BASSE', 'MOYENNE', 'HAUTE', 'CRITIQUE'].map((p) => <option key={p}>{p}</option>)}</select></div>
      </div>
      <div className="form-r">
        <div className="form-g"><label>Fournisseur</label><select value={f.supplierCode ?? ''} onChange={set('supplierCode')}><option value="">—</option>{suppliers.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}</select></div>
        <div className="form-g"><label>N° commande</label><input value={(f as { cmd?: string }).cmd ?? ''} onChange={set('cmd' as keyof MaintenanceOrder)} /></div>
      </div>
      <div className="form-r">
        <div className="form-g"><label>Coût Pièces (DA)</label><input type="number" value={f.partsCost ?? ""} onChange={set('partsCost')} /></div>
        <div className="form-g"><label>Coût M.O. (DA)</label><input type="number" value={f.laborCost ?? ""} onChange={set('laborCost')} /></div>
      </div>
      <div className="form-g"><label>Heures d&apos;immobilisation</label><input type="number" value={(f as { breakdownHours?: number }).breakdownHours ?? ""} onChange={set('breakdownHours' as keyof MaintenanceOrder)} /></div>
    </Modal>
  );
}

function PlanModal({ plan, vehicles, onClose }: { plan: Record<string, unknown> | null; vehicles: Vehicle[]; onClose: () => void }) {
  const isEdit = !!plan;
  const [f, setF] = useState<any>(plan ?? {
    name: '', targetKind: 'type', targetValue: 'LOURD', trigger: 'KM', intervalValue: 10000, alertThresholdPct: 90, active: true,
    operations: [{ label: 'Vidange huile moteur', coutEstime: 8000 }],
  });
  const client = useQueryClient();
  const set = (k: string, v: unknown) => setF((s: any) => ({ ...s, [k]: v }));

  // « Valeur » = liste de choix selon la cible (retour DG : pas de saisie libre).
  const listsCfg = useConfig<VehicleLists>('VEHICLE_LISTS');
  const valueOptions = useMemo(() => {
    const uniq = (arr: (string | null | undefined)[]) =>
      [...new Set(arr.map((x) => (x ?? '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
    if (f.targetKind === 'type') return normalizeVehicleLists(listsCfg.data).type;
    if (f.targetKind === 'marque') return uniq(vehicles.map((v) => v.brand));
    if (f.targetKind === 'modele') return uniq(vehicles.map((v) => v.model));
    return [] as string[];
  }, [f.targetKind, listsCfg.data, vehicles]);
  const cur = String(f.targetValue ?? '').trim();
  const valueList = cur && !valueOptions.includes(cur) ? [cur, ...valueOptions] : valueOptions;

  const submit = async () => {
    if (!f.name) { toast.error('Nom requis'); return; }
    const body = { ...f, intervalValue: Number(f.intervalValue) || 0, alertThresholdPct: Number(f.alertThresholdPct) || 90 };
    if (isEdit) await api.patch(`/maintenance-plans/${(plan as any).id}`, body);
    else await api.post('/maintenance-plans', body);
    client.invalidateQueries({ queryKey: ['maintenance-plans'] });
    client.invalidateQueries({ queryKey: ['maintenance-due'] });
    toast.success('Modèle enregistré');
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={isEdit ? 'Modifier le modèle' : 'Nouveau modèle d’entretien'} wide
      footer={<><button className="btn btn-o" onClick={onClose}>Annuler</button><button className="btn btn-p" onClick={submit}>Enregistrer</button></>}>
      <div className="form-r">
        <div className="form-g"><label>Nom *</label><input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Vidange 10 000 km" /></div>
        <div className="form-g"><label>Déclencheur</label><select value={f.trigger} onChange={(e) => set('trigger', e.target.value)}><option value="KM">Kilométrage</option><option value="HOURS">Heures moteur</option></select></div>
      </div>
      <div className="form-r">
        <div className="form-g"><label>Cible</label><select value={f.targetKind} onChange={(e) => setF((s: any) => ({ ...s, targetKind: e.target.value, targetValue: '' }))}><option value="type">Type de véhicule</option><option value="marque">Marque</option><option value="modele">Modèle</option><option value="vehicles">Liste de véhicules</option></select></div>
        {f.targetKind === 'vehicles' ? (
          <div className="form-g"><label>Véhicules</label>
            <select multiple value={f.targetVehicles ?? []} onChange={(e) => set('targetVehicles', Array.from(e.target.selectedOptions).map((o) => o.value))} style={{ minHeight: 90 }}>
              {vehicles.map((v) => <option key={v.code} value={v.code}>{v.code} — {v.brand} {v.model}</option>)}
            </select>
          </div>
        ) : (
          <div className="form-g"><label>Valeur</label>
            <select value={cur} onChange={(e) => set('targetValue', e.target.value)}>
              <option value="">— choisir —</option>
              {valueList.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            {valueOptions.length === 0 && (
              <div className="vf-hint">Aucune valeur — {f.targetKind === 'type' ? 'ajoutez des types dans Paramètres › Listes Flotte' : 'aucun véhicule enregistré pour cette cible'}.</div>
            )}
          </div>
        )}
      </div>
      <div className="form-r">
        <div className="form-g"><label>Intervalle ({f.trigger === 'HOURS' ? 'h' : 'km'})</label><input type="number" value={f.intervalValue} onChange={(e) => set('intervalValue', e.target.value)} /></div>
        <div className="form-g"><label>Seuil d&apos;alerte (%)</label><input type="number" value={f.alertThresholdPct} onChange={(e) => set('alertThresholdPct', e.target.value)} /></div>
      </div>
      <div className="form-g">
        <label>Opérations</label>
        {(f.operations ?? []).map((op: any, i: number) => (
          <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
            <input value={op.label} onChange={(e) => { const ops = [...f.operations]; ops[i] = { ...ops[i], label: e.target.value }; set('operations', ops); }} placeholder="Opération" style={{ flex: 2 }} />
            <input type="number" value={op.coutEstime} onChange={(e) => { const ops = [...f.operations]; ops[i] = { ...ops[i], coutEstime: Number(e.target.value) }; set('operations', ops); }} placeholder="Coût" style={{ flex: 1 }} />
            <button className="btn btn-r btn-sm" onClick={() => set('operations', f.operations.filter((_: unknown, j: number) => j !== i))}>✕</button>
          </div>
        ))}
        <button className="btn btn-o btn-sm" onClick={() => set('operations', [...(f.operations ?? []), { label: '', coutEstime: 0 }])}>+ Opération</button>
      </div>
    </Modal>
  );
}

function TiresTab({ tires, inventory, vehicles, onNew, onMove }: {
  tires: any[]; inventory: any; vehicles: Vehicle[]; onNew: () => void; onMove: (id: string, ref: string) => void;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const movements = useTireMovements(sel ?? undefined);
  const vLabel = (c: string | null) => { const v = vehicles.find((x) => x.code === c); return v ? `${c} — ${v.brand} ${v.model}` : c ?? '—'; };
  const search = useSearch<any>(tires, (t) => [t.reference, t.brand, t.dimensions, t.serialNumber, t.status, t.currentVehicle, t.position].join(' '));
  return (
    <div className="tpane act">
      <div className="rap-kpi-row">
        <div className="rap-kpi kpi-b"><div className="rap-kpi-label">En stock</div><div className="rap-kpi-val">{inventory?.stockCount ?? 0}</div></div>
        <div className="rap-kpi kpi-g"><div className="rap-kpi-label">Montés</div><div className="rap-kpi-val">{tires.filter((t) => t.status === 'monte').length}</div></div>
        <div className="rap-kpi kpi-a"><div className="rap-kpi-label">Déposés</div><div className="rap-kpi-val">{inventory?.deposeCount ?? 0}</div></div>
        <div className="rap-kpi kpi-r"><div className="rap-kpi-label">Rebut</div><div className="rap-kpi-val">{inventory?.rebutCount ?? 0}</div></div>
      </div>
      <div className="tc">
        <div className="th"><h3>Parc Pneumatiques</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <SearchBox value={search.q} onChange={search.setQ} placeholder="Réf, série, dimensions, véhicule…" count={search.count} total={tires.length} />
            <button className="btn btn-p btn-sm" onClick={onNew}>+ Achat pneu (entrée stock)</button>
          </div>
        </div>
        <div className="tw">
          <table>
            <thead><tr><th>Référence</th><th>Marque</th><th>Dimensions</th><th>N° série</th><th>Statut</th><th>Véhicule</th><th>Position</th><th>Km montage</th><th>Actions</th></tr></thead>
            <tbody>
              {search.filtered.map((t) => (
                <tr key={t.id} className="clickable" onClick={() => setSel(sel === t.id ? null : t.id)}>
                  <td>{t.reference}</td><td>{t.brand ?? '—'}</td><td>{t.dimensions ?? '—'}</td><td>{t.serialNumber ?? '—'}</td>
                  <td><span className={`bg ${t.status === 'monte' ? 'bg-g' : t.status === 'stock' ? 'bg-b' : t.status === 'rebut' ? 'bg-r' : 'bg-a'}`}>{t.status}</span></td>
                  <td>{t.currentVehicle ?? '—'}</td><td>{t.position ?? '—'}</td><td>{t.mountKm ? fk(t.mountKm) : '—'}</td>
                  <td onClick={(e) => e.stopPropagation()}><button className="btn btn-o btn-sm" onClick={() => onMove(t.id, t.reference)}>Mouvement</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {sel && (
        <div className="tc" style={{ marginTop: 10 }}>
          <div className="th"><h3>Historique du pneu {tires.find((t) => t.id === sel)?.reference}</h3></div>
          <div className="tw">
            <table>
              <thead><tr><th>Date</th><th>Type</th><th>Origine</th><th>Destination</th><th>Position</th><th>Km</th><th>Signé par</th></tr></thead>
              <tbody>
                {(movements.data ?? []).map((m: any) => (
                  <tr key={m.id}><td>{fd(m.date)}</td><td><span className="bg bg-t">{m.type}</span></td><td>{vLabel(m.fromVehicle)}</td><td>{vLabel(m.toVehicle)}</td><td>{m.position ?? '—'}</td><td>{m.km ? fk(m.km) : '—'}</td><td>{m.signedBy ?? '—'}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function TireModal({ data, vehicles, onClose }: { data: 'new' | { id: string; ref: string }; vehicles: Vehicle[]; onClose: () => void }) {
  const move = useMoveTire();
  const create = useCreate('tires');
  const isNew = data === 'new';
  const [f, setF] = useState<any>(isNew
    ? { reference: '', brand: '', dimensions: '', serialNumber: '', purchaseDate: new Date().toISOString().slice(0, 10), purchaseCost: 0 }
    : { type: 'montage', toVehicle: vehicles[0]?.code, position: 'AVG', km: 0, date: new Date().toISOString().slice(0, 10), signedBy: '' });
  const set = (k: string, v: unknown) => setF((s: any) => ({ ...s, [k]: v }));
  const submit = async () => {
    if (isNew) {
      if (!f.reference) { toast.error('Référence requise'); return; }
      await create.mutateAsync({ ...f, purchaseCost: Number(f.purchaseCost) || 0 });
      toast.success('Pneu ajouté au stock');
    } else {
      await move.mutateAsync({ id: (data as { id: string }).id, body: { ...f, km: Number(f.km) || 0 } });
      toast.success('Mouvement enregistré');
    }
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={isNew ? 'Achat pneumatique' : `Mouvement — pneu ${(data as { ref: string }).ref}`}
      footer={<><button className="btn btn-o" onClick={onClose}>Annuler</button><button className="btn btn-p" onClick={submit}>Enregistrer</button></>}>
      {isNew ? (
        <>
          <div className="form-r">
            <div className="form-g"><label>Référence *</label><input value={f.reference} onChange={(e) => set('reference', e.target.value)} placeholder="315/80 R22.5" /></div>
            <div className="form-g"><label>Marque</label><input value={f.brand} onChange={(e) => set('brand', e.target.value)} /></div>
          </div>
          <div className="form-r">
            <div className="form-g"><label>Dimensions</label><input value={f.dimensions} onChange={(e) => set('dimensions', e.target.value)} /></div>
            <div className="form-g"><label>N° série</label><input value={f.serialNumber} onChange={(e) => set('serialNumber', e.target.value)} /></div>
          </div>
          <div className="form-r">
            <div className="form-g"><label>Date d&apos;achat</label><DateInput value={f.purchaseDate} onChange={(e) => set('purchaseDate', e.target.value)} /></div>
            <div className="form-g"><label>Coût (DA)</label><input type="number" value={f.purchaseCost} onChange={(e) => set('purchaseCost', e.target.value)} /></div>
          </div>
        </>
      ) : (
        <>
          <div className="form-g"><label>Type de mouvement</label>
            <select value={f.type} onChange={(e) => set('type', e.target.value)}>
              <option value="montage">Montage (stock → véhicule)</option>
              <option value="depose">Dépose (véhicule → déposé)</option>
              <option value="transfert">Transfert (véhicule → véhicule)</option>
              <option value="rebut">Mise au rebut</option>
            </select>
          </div>
          {(f.type === 'montage' || f.type === 'transfert') && (() => {
            const destV = vehicles.find((v) => v.code === f.toVehicle);
            const poss = positionsFor(destV?.type);
            return (
              <div className="form-r">
                <div className="form-g"><label>Véhicule destination</label>
                  <select value={f.toVehicle} onChange={(e) => set('toVehicle', e.target.value)}>
                    {vehicles.map((v) => <option key={v.code} value={v.code}>{v.code} — {v.brand} {v.model} ({v.type})</option>)}
                  </select>
                </div>
                <div className="form-g"><label>Position ({destV?.type ?? '—'} : {poss.length} positions)</label>
                  <select value={poss.includes(f.position) ? f.position : poss[0]} onChange={(e) => set('position', e.target.value)}>
                    {poss.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>
            );
          })()}
          <div className="form-r">
            <div className="form-g"><label>Km au moment du mouvement</label><input type="number" value={f.km} onChange={(e) => set('km', e.target.value)} /></div>
            <div className="form-g"><label>Date</label><DateInput value={f.date} onChange={(e) => set('date', e.target.value)} /></div>
          </div>
          <div className="form-g"><label>Bénéficiaire (signe le document)</label><input value={f.signedBy} onChange={(e) => set('signedBy', e.target.value)} /></div>
        </>
      )}
    </Modal>
  );
}

