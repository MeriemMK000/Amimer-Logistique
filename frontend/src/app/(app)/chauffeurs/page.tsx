'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  useConfig, useConfirmedRemove, useCreate, useDrivers, useEvaluations, useMissions, useQualifications,
  useUpdate, useVehicleAssignments, useVehicles,
} from '@/lib/api/hooks';
import StatusBadge from '@/components/ui/StatusBadge';
import ExpiryBadge from '@/components/ui/ExpiryBadge';
import { icons } from '@/components/ui/icons';
import Tabs from '@/components/ui/Tabs';
import Modal from '@/components/ui/Modal';
import SearchBox from '@/components/ui/SearchBox';
import { useSearch } from '@/lib/useSearch';
import DriverFormModal from '@/components/chauffeurs/DriverFormModal';
import DriverWeekGrid from '@/components/chauffeurs/DriverWeekGrid';
import { useBuCcLabel } from '@/components/ui/BuCcSelect';
import DateInput from '@/components/ui/DateInput';
import { DEFAULT_EVAL_CONFIG, computeEvalScore, evalColor } from '@/lib/fleet/evaluation';
import { driverCostModel } from '@/lib/fleet/vehicleCost';
import ServiceCarFormModal from '@/components/chauffeurs/ServiceCarFormModal';
import { fd, fk } from '@/lib/fleet/format';
import type { Driver, EvalConfig, Vehicle, VehicleAssignment } from '@/lib/types';

const plus = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;


function fatColor(f: number) {
  return f >= 0.9 ? 'var(--r6)' : f >= 0.7 ? 'var(--a6)' : 'var(--g6)';
}

/** Retour DG : distinguer un chauffeur d'un utilisateur (voiture de service). */
const isUser = (d: Driver) => d.personType === 'utilisateur';
function PersonIcon({ d }: { d: Driver }) {
  return isUser(d)
    ? <span title="Utilisateur — voiture de service (ne part pas en mission)" style={{ display: 'inline-flex', color: 'var(--a6)' }}>{icons.users}</span>
    : <span title="Chauffeur — conduit des véhicules en mission" style={{ display: 'inline-flex', color: 'var(--b6)' }}>{icons.truck}</span>;
}

export default function ChauffeursPage() {
  const [tab, setTab] = useState(0);
  const [form, setForm] = useState<Driver | null | undefined>(undefined);
  const [detail, setDetail] = useState<Driver | null>(null);
  const [ptFilter, setPtFilter] = useState<'all' | 'chauffeur' | 'utilisateur'>('all');

  const drivers = useDrivers();
  const removeDriver = useConfirmedRemove('drivers', 'ce chauffeur / utilisateur');
  const vehicles = useVehicles();
  const missions = useMissions();
  const quals = useQualifications();
  const evals = useEvaluations();
  const evalCfg = useConfig<EvalConfig>('EVAL_CONFIG');
  const assignments = useVehicleAssignments();
  const dedicatedLabel = useBuCcLabel();

  const D = drivers.data ?? [];
  const V = vehicles.data ?? [];
  const MI = missions.data ?? [];
  const AS = assignments.data ?? [];
  const vhLabel = (c: string | null) => {
    const v = V.find((x) => x.code === c);
    return v ? `${v.code} — ${v.brand} ${v.model}` : '—';
  };
  const Dfilt = ptFilter === 'all' ? D : D.filter((d) => (ptFilter === 'utilisateur' ? isUser(d) : !isUser(d)));
  const search = useSearch(Dfilt, (d) => [d.code, d.name, d.license, d.status, d.phone, (d.quals ?? []).join(' '), vhLabel(d.vehicleCode), dedicatedLabel(d.dedicatedTo, d.dedicatedCa)].join(' '));
  const nbChauf = D.filter((d) => !isUser(d)).length;
  const nbUser = D.filter(isUser).length;

  return (
    <div className="page active">
      <Tabs tabs={['Liste Chauffeurs', 'Voitures de service', 'Planning Horaire', 'Qualifications', 'Disponibilité', 'Évaluations']} active={tab} onChange={setTab} />

      {tab === 0 && (
        <div className="tpane act">
          <div className="tc">
            <div className="th"><h3>Chauffeurs &amp; Utilisateurs ({search.count}{search.q || ptFilter !== 'all' ? ` / ${D.length}` : ''})</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="fb">
                  {([['all', `Tous (${D.length})`], ['chauffeur', `Chauffeurs (${nbChauf})`], ['utilisateur', `Utilisateurs (${nbUser})`]] as const).map(([k, lb]) => (
                    <button key={k} className={`fc${ptFilter === k ? ' act' : ''}`} onClick={() => setPtFilter(k)}>{lb}</button>
                  ))}
                </div>
                <SearchBox value={search.q} onChange={search.setQ} placeholder="Nom, n°, permis, qualif…" />
                <button className="btn btn-p" onClick={() => setForm(null)}>{plus} Ajouter</button>
              </div>
            </div>
            <div className="tw">
              <table>
                <thead><tr><th></th><th>N°</th><th>Nom</th><th>Type</th><th>Permis</th><th>Exp. permis</th><th>Qualif.</th><th>Statut</th><th>H/Sem</th><th>Fatigue</th><th>Véhicule</th><th>Perm.</th></tr></thead>
                <tbody>
                  {search.filtered.map((d) => {
                    const fp = Math.round((d.fatigue ?? 0) * 100);
                    const u = isUser(d);
                    return (
                      <tr key={d.code} className="clickable" onClick={() => setDetail(d)} onDoubleClick={(e) => { e.stopPropagation(); setForm(d); }}>
                        <td style={{ width: 26, textAlign: 'center' }}><PersonIcon d={d} /></td>
                        <td>{d.code}</td><td>{d.name}</td>
                        <td><span className={`bg ${u ? 'bg-a' : 'bg-b'}`}>{u ? 'Utilisateur' : 'Chauffeur'}</span></td>
                        <td>{d.license}</td>
                        <td><ExpiryBadge expiry={d.licenseExpiry} /></td>
                        <td>{d.quals?.length ? d.quals.map((q) => <span key={q} className="bg bg-t" style={{ marginRight: 3 }}>{q}</span>) : '—'}</td>
                        <td><StatusBadge status={d.status} /></td>
                        <td>{u ? '—' : `${d.hoursWeek}h`}</td>
                        <td>
                          {u ? <span style={{ color: 'var(--tm)' }}>—</span> : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div className="pb" style={{ width: 50 }}><div className="pf" style={{ width: `${fp}%`, background: (d.fatigue ?? 0) >= 0.9 ? 'var(--r5)' : (d.fatigue ?? 0) >= 0.7 ? 'var(--a5)' : 'var(--g5)' }} /></div>
                            <span style={{ color: fatColor(d.fatigue ?? 0), fontSize: '.7rem', fontWeight: (d.fatigue ?? 0) >= 0.9 ? 600 : 400 }}>{fp}%</span>
                          </div>
                          )}
                        </td>
                        <td>{d.vehicleCode ? vhLabel(d.vehicleCode) : '—'}</td>
                        <td>{d.permanent ? <span className="bg bg-g">Oui</span> : <span className="bg bg-a">Non</span>}</td>
                      </tr>
                    );
                  })}
                  {!search.filtered.length && <tr><td colSpan={12} style={{ textAlign: 'center', color: 'var(--tm)', padding: 16 }}>Aucun{ptFilter === 'utilisateur' ? ' utilisateur' : ptFilter === 'chauffeur' ? ' chauffeur' : 'e personne'} ne correspond{search.q ? ` à « ${search.q} »` : ''}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 1 && (
        <ServiceCarsTab assignments={AS} vehicles={V} drivers={D} dedicatedLabel={dedicatedLabel} />
      )}

      {tab === 2 && (
        <div className="tpane act">
          <div style={{ marginBottom: 8, fontSize: '.78rem', color: 'var(--tm)' }}>
            Planning horaire hebdomadaire — plages <b style={{ color: 'var(--g6)' }}>ouvertes</b> (disponible) /{' '}
            <b style={{ color: 'var(--b6)' }}>occupées</b> (mission, maintenance, formation, repos).
          </div>
          <DriverWeekGrid drivers={D} missions={MI} onOpenDriver={setDetail} />
        </div>
      )}

      {tab === 3 && (
        <QualificationsTab quals={quals.data ?? []} drivers={D} />
      )}

      {tab === 4 && (
        <div className="tpane act">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
            {D.map((d) => {
              const fp = Math.round((d.fatigue ?? 0) * 100);
              const mis = MI.filter((m) => m.driverCode === d.code && (m.status === 'EN_COURS' || m.status === 'PLANIFIEE'));
              return (
                <div key={d.code} className="eval-item" style={{ cursor: 'pointer' }} onClick={() => setDetail(d)}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div className="ev-label">{d.name}</div><StatusBadge status={d.status} />
                  </div>
                  <div style={{ fontSize: '.75rem', color: 'var(--ts)', marginBottom: 4 }}>
                    Permis {d.license} · {d.hoursWeek}h/sem · Fatigue <span style={{ color: fatColor(d.fatigue ?? 0), fontWeight: 600 }}>{fp}%</span>
                  </div>
                  <div style={{ fontSize: '.7rem', color: 'var(--tm)' }}>{d.vehicleCode ? `VH: ${d.vehicleCode}${d.permanent ? ' (perm)' : ' (temp)'}` : 'Aucun véhicule'}</div>
                  <div style={{ marginTop: 6, fontSize: '.68rem', color: mis.length ? 'var(--b6)' : 'var(--g6)' }}>
                    {mis.length ? `${mis.length} mission(s) planifiées/en cours` : 'Disponible pour affectation'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 5 && (
        <EvaluationsTab evals={evals.data ?? []} drivers={D} vehicles={V} evalConfig={evalCfg.data ?? DEFAULT_EVAL_CONFIG} />
      )}

      {form !== undefined && (
        <DriverFormModal open onClose={() => setForm(undefined)} driver={form} driverCount={D.length} vehicles={V} qualifications={(quals.data ?? []) as { code: string; label: string }[]} />
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `${detail.name} (${detail.code})` : ''}
        footer={<>
          <button className="btn btn-r" style={{ marginRight: 'auto' }} onClick={() => { if (detail) { const d = detail; setDetail(null); removeDriver(d.code, d.name); } }}>Supprimer</button>
          <button className="btn btn-o" onClick={() => setDetail(null)}>Fermer</button>
          <button className="btn btn-p" onClick={() => { setForm(detail!); setDetail(null); }}>Modifier</button>
        </>}>
        {detail && (
          <div className="eval-grid">
            {([
              ['Type', isUser(detail) ? <span key="t" className="bg bg-a">Utilisateur</span> : <span key="t" className="bg bg-b">Chauffeur</span>],
              ['Permis', `${detail.license} — exp. ${fd(detail.licenseExpiry)}`],
              ['Statut', <StatusBadge key="s" status={detail.status} />],
              ['Coût', (() => { const c = driverCostModel(detail); return c.undefinedCost ? <span key="c" className="bg bg-r">non défini</span> : `${fk(c.daily)} DA/j · ${fk(c.hourly)} DA/h`; })()],
              ['Qualifications', detail.quals?.join(', ') || '—'],
              ['Heures / semaine', `${detail.hoursWeek}h / max ${(detail as { maxWeeklyHours?: number }).maxWeeklyHours ?? 48}h`],
              ['Heures / mois', `${detail.hoursMonth}h`],
              ['Fatigue', `${Math.round((detail.fatigue ?? 0) * 100)}%`],
              ['Apte mission', (detail as { apteMission?: boolean }).apteMission === false ? <span key="a" className="bg bg-r">Non</span> : <span key="a" className="bg bg-g">Oui</span>],
              ['Chauffeur dédié à', dedicatedLabel(detail.dedicatedTo, detail.dedicatedCa)],
              ['Lieu de travail', (detail as { workLocation?: string }).workLocation || '—'],
              ['Véhicule', detail.vehicleCode ? vhLabel(detail.vehicleCode) : 'Aucun'],
              ['Permanent', detail.permanent ? 'Oui' : 'Non'],
              ['Téléphone', detail.phone ?? '—'],
            ] as [string, React.ReactNode][]).map(([k, v]) => (
              <div className="eval-item" key={k}><div className="ev-label">{k}</div><div className="ev-val" style={{ fontSize: '.85rem' }}>{v}</div></div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}


/* ─── Voitures de service (voitures de fonction) ─────────────────────────────
 * Retour DG : les véhicules attribués à une personne doivent être DÉCLARÉS ici
 * (sinon « voitures affectées mais non déclarées »), avec BU + centre de coût
 * pour la refacturation, et ils sont EXCLUS de la sélection des missions.
 * Source unique = `vehicle_assignments` (kind permanent + assigneeName), partagée
 * avec « Sites & Engins → Affectations ». */
function ServiceCarsTab({ assignments, vehicles, drivers, dedicatedLabel }: {
  assignments: VehicleAssignment[];
  vehicles: Vehicle[];
  drivers: Driver[];
  dedicatedLabel: (bu: string | null | undefined, cc?: string | null) => string;
}) {
  const [form, setForm] = useState<VehicleAssignment | null | undefined>(undefined);
  const remove = useConfirmedRemove('vehicle-assignments', 'cette voiture de service');
  const today = new Date().toISOString().slice(0, 10);

  const vLabel = (c: string | null) => {
    const v = vehicles.find((x) => x.code === c);
    return v ? `${v.brand} ${v.model}` : (c ?? '—');
  };
  const drLabel = (c: string | null) => drivers.find((d) => d.code === c)?.name ?? c ?? '—';
  const isActive = (a: VehicleAssignment) => (!a.dateEnd || a.dateEnd >= today) && (!a.dateStart || a.dateStart <= today);

  const cars = assignments
    .filter((a) => a.assigneeName)
    .sort((a, b) => Number(isActive(b)) - Number(isActive(a)) || (a.assigneeName ?? '').localeCompare(b.assigneeName ?? ''));
  const search = useSearch(cars, (a) => [a.vehicleCode, vLabel(a.vehicleCode), a.assigneeName, a.structure,
    a.businessUnit, a.costCenter, drLabel(a.driverCode), a.fuelCardNumber].join(' '));

  const dedicatedDrivers = drivers.filter((d) => d.dedicatedTo);
  const totalMonthly = cars.filter(isActive).reduce((s, a) => s + (a.vehicleMonthlyCost ?? 0), 0);

  return (
    <div className="tpane act">
      <div className="tc">
        <div className="th">
          <h3>Voitures de service ({search.count}{search.q ? ` / ${cars.length}` : ''})</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <SearchBox value={search.q} onChange={search.setQ} placeholder="Personne, véhicule, structure, BU…" />
            <button className="btn btn-p" onClick={() => setForm(null)}>+ Voiture de service</button>
          </div>
        </div>
        <div style={{ fontSize: '.74rem', color: 'var(--tm)', padding: '0 14px 10px' }}>
          Véhicules attribués en permanence à une personne (voiture de fonction). Ils sont <b>exclus de la sélection des missions</b> et
          leur coût est refacturé à la BU / au centre de coût. Coût mensuel véhicules actifs : <b>{fk(Math.round(totalMonthly))} DA</b>.
          {' '}Gérable aussi depuis <b>Sites &amp; Engins → Affectations</b>.
        </div>
        <div className="tw">
          <table>
            <thead><tr>
              <th>Personne / Structure</th><th>BU / Centre de coût</th><th>Véhicule / Chauffeur</th>
              <th>Carte carburant / domicile</th><th>Coût véh./mois</th><th>Période</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {search.filtered.map((a) => {
                const active = isActive(a);
                return (
                  <tr key={a.id} className="clickable" onClick={() => setForm(a)} style={active ? undefined : { opacity: 0.55 }}>
                    <td style={{ fontWeight: 600 }}>{a.assigneeName}
                      <div style={{ fontWeight: 400, color: 'var(--tm)', fontSize: '.72rem' }}>{a.structure ?? '—'}</div>
                    </td>
                    <td style={{ fontSize: '.74rem' }}>{dedicatedLabel(a.businessUnit, a.costCenter)}</td>
                    <td style={{ fontWeight: 600 }}>{a.vehicleCode} <span style={{ fontWeight: 400, color: 'var(--tm)', fontSize: '.72rem' }}>{vLabel(a.vehicleCode)}</span>
                      <div style={{ fontWeight: 400, fontSize: '.72rem', color: a.withDriver ? 'var(--tp)' : 'var(--tm)' }}>{a.withDriver ? `${drLabel(a.driverCode)}` : 'sans chauffeur'}</div>
                    </td>
                    <td style={{ fontSize: '.72rem' }}>
                      {[a.fuelCardNumber, a.monthlyFuelCap ? `${fk(a.monthlyFuelCap)} DA/mois` : null].filter(Boolean).join(' · ') || '—'}
                      {a.dailyHomeKm ? <div style={{ color: 'var(--tm)' }}>domicile {fk(a.dailyHomeKm)} km/j</div> : null}
                    </td>
                    <td>{a.vehicleMonthlyCost ? `${fk(a.vehicleMonthlyCost)} DA` : '—'}</td>
                    <td style={{ fontSize: '.72rem' }} title={`${fd(a.dateStart)}${a.dateEnd ? ` → ${fd(a.dateEnd)}` : ' → en cours'}`}>
                      {active ? <span className="bg bg-g">Active</span> : <span className="bg bg-r">Terminée</span>}
                      <div style={{ color: 'var(--tm)' }}>depuis {fd(a.dateStart)}</div>
                    </td>
                    <td onClick={(e) => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn btn-o btn-sm" onClick={() => setForm(a)}>Modifier</button>{' '}
                      <button className="btn btn-r btn-sm" onClick={() => remove(a.id, `${a.assigneeName} · ${a.vehicleCode}`)}>Suppr.</button>
                    </td>
                  </tr>
                );
              })}
              {!search.filtered.length && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--tm)', padding: 18 }}>
                  {cars.length ? `Aucune voiture de service ne correspond à « ${search.q} »` : 'Aucune voiture de service déclarée'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!!dedicatedDrivers.length && (
        <div className="tc" style={{ marginTop: 12 }}>
          <div className="th"><h3>Chauffeurs dédiés à une structure ({dedicatedDrivers.length})</h3></div>
          <div style={{ fontSize: '.74rem', color: 'var(--tm)', padding: '0 14px 10px' }}>
            Chauffeurs rattachés à une BU / un centre de coût (champ « Chauffeur dédié à » de la fiche). Leur coût suit cette structure.
          </div>
          <div className="tw">
            <table>
              <thead><tr><th>Chauffeur</th><th>BU / Centre de coût</th><th>Véhicule attitré</th><th>Statut</th></tr></thead>
              <tbody>
                {dedicatedDrivers.map((d) => (
                  <tr key={d.code}>
                    <td style={{ fontWeight: 600 }}>{d.code} — {d.name}</td>
                    <td style={{ fontSize: '.74rem' }}>{dedicatedLabel(d.dedicatedTo, d.dedicatedCa)}</td>
                    <td>{d.vehicleCode ? `${d.vehicleCode} — ${vLabel(d.vehicleCode)}` : '—'}</td>
                    <td><StatusBadge status={d.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {form !== undefined && (
        <ServiceCarFormModal open onClose={() => setForm(undefined)} assignment={form} vehicles={vehicles} drivers={drivers} />
      )}
    </div>
  );
}

function QualificationsTab({ quals, drivers }: { quals: any[]; drivers: Driver[] }) {
  const create = useCreate('qualifications');
  const update = useUpdate('qualifications');
  const remove = useConfirmedRemove('qualifications', 'cette qualification');
  const [form, setForm] = useState<any | null>(null);
  const countFor = (code: string) => drivers.filter((d) => (d.quals ?? []).includes(code)).length;
  return (
    <div className="tpane act">
      <div className="tc">
        <div className="th"><h3>Qualifications ({quals.length})</h3><div><button className="btn btn-p btn-sm" onClick={() => setForm({ code: '', label: '', description: '', sensitive: false })}>+ Qualification</button></div></div>
        <div style={{ fontSize: '.75rem', color: 'var(--tm)', padding: '0 14px 10px' }}>
          Ces qualifications sont utilisées dans le module Missions pour rechercher les chauffeurs habilités
          aux missions sensibles (matières dangereuses, transport de personnes…).
        </div>
        <div className="tw">
          <table>
            <thead><tr><th>Code</th><th>Libellé</th><th>Description</th><th>Sensible</th><th>Chauffeurs</th><th>Actions</th></tr></thead>
            <tbody>
              {quals.map((q) => (
                <tr key={q.code} className="clickable" onClick={() => setForm(q)}>
                  <td style={{ fontWeight: 600 }}>{q.code}</td><td>{q.label}</td>
                  <td style={{ fontSize: '.72rem', color: 'var(--tm)' }}>{q.description}</td>
                  <td>{q.sensitive ? <span className="bg bg-a">Oui</span> : <span className="bg bg-g">Non</span>}</td>
                  <td>{countFor(q.code)}</td>
                  <td onClick={(e) => e.stopPropagation()}><button className="btn btn-r btn-sm" onClick={() => remove(q.code, q.label)}>Suppr.</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {form && (
        <Modal open onClose={() => setForm(null)} title={form.code && quals.some((q) => q.code === form.code) ? `Modifier ${form.code}` : 'Nouvelle qualification'}
          footer={<><button className="btn btn-o" onClick={() => setForm(null)}>Annuler</button>
            <button className="btn btn-p" onClick={async () => {
              if (!form.code || !form.label) { toast.error('Code et libellé requis'); return; }
              const exists = quals.some((q) => q.code === form.code);
              if (exists) await update.mutateAsync({ id: form.code, body: form });
              else await create.mutateAsync(form);
              toast.success('Qualification enregistrée'); setForm(null);
            }}>Enregistrer</button></>}>
          <div className="form-r">
            <div className="form-g"><label>Code *</label><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} readOnly={quals.some((q) => q.code === form.code)} /></div>
            <div className="form-g"><label>Libellé *</label><input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></div>
          </div>
          <div className="form-g"><label>Description</label><input value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="form-g"><label><input type="checkbox" checked={!!form.sensitive} onChange={(e) => setForm({ ...form, sensitive: e.target.checked })} /> Qualification sensible (mission à risque)</label></div>
        </Modal>
      )}
    </div>
  );
}

function EvaluationsTab({ evals, drivers, vehicles, evalConfig }: { evals: any[]; drivers: Driver[]; vehicles: any[]; evalConfig: EvalConfig }) {
  const create = useCreate('evaluations');
  const remove = useConfirmedRemove('evaluations', 'cette évaluation');
  const cfg = evalConfig?.criteria?.length ? evalConfig : DEFAULT_EVAL_CONFIG;
  const [form, setForm] = useState<any | null>(null);
  const search = useSearch(evals, (e) => [e.date, e.subjectCode, e.subjectType, e.source, e.note,
    drivers.find((d) => d.code === e.subjectCode)?.name, drivers.find((d) => d.code === e.relatedDriver)?.name].join(' '));

  const label = (e: any) => e.subjectType === 'driver'
    ? drivers.find((d) => d.code === e.subjectCode)?.name ?? e.subjectCode
    : `${e.subjectCode}`;

  const openForm = (mode: 'responsable' | 'scaleup' | 'vehicle') => {
    const base: any = { date: new Date().toISOString().slice(0, 10), note: '', relatedDriver: '', criteria: {} };
    if (mode === 'scaleup') setForm({ ...base, mode, subjectType: 'driver', subjectCode: drivers[0]?.code, score: '' });
    else if (mode === 'vehicle') setForm({ ...base, mode, subjectType: 'vehicle', subjectCode: vehicles[0]?.code, score: 15 });
    else setForm({ ...base, mode, subjectType: 'driver', subjectCode: drivers[0]?.code });
  };

  const previewScore = form && form.mode === 'responsable' ? computeEvalScore(form.criteria ?? {}, cfg) : null;

  const submit = async () => {
    if (!form.subjectCode || !form.date) { toast.error('Champs obligatoires : sujet évalué, date'); return; }
    if (form.mode === 'responsable') {
      const score = computeEvalScore(form.criteria ?? {}, cfg);
      await create.mutateAsync({
        subjectType: 'driver', subjectCode: form.subjectCode, date: form.date,
        score: Math.round(score * 100) / 100, note: form.note, source: 'responsable',
        criteria: { ...form.criteria, __scale: cfg.scale },
      });
    } else if (form.mode === 'scaleup') {
      await create.mutateAsync({
        subjectType: 'driver', subjectCode: form.subjectCode, date: form.date,
        score: Number(form.score) || 0, note: form.note, source: 'scaleup', criteria: { __scale: cfg.scale },
      });
    } else {
      await create.mutateAsync({ subjectType: 'vehicle', subjectCode: form.subjectCode, date: form.date, score: Number(form.score) || 0, note: form.note, source: 'controle', relatedDriver: form.relatedDriver || null, criteria: { __scale: cfg.scale } });
      if (form.relatedDriver) {
        await create.mutateAsync({ subjectType: 'driver', subjectCode: form.relatedDriver, date: form.date, score: Number(form.score) || 0, note: `(via contrôle véhicule ${form.subjectCode}) ${form.note ?? ''}`, source: 'controle', relatedVehicle: form.subjectCode, criteria: { __scale: cfg.scale } });
      }
    }
    toast.success('Évaluation enregistrée'); setForm(null);
  };

  return (
    <div className="tpane act">
      <div className="tc">
        <div className="th"><h3>Évaluations Chauffeurs</h3>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <SearchBox value={search.q} onChange={search.setQ} placeholder="Chauffeur, date, source…" count={search.count} total={evals.length} />
            <button className="btn btn-p btn-sm" onClick={() => openForm('responsable')}>+ Notation responsable</button>
            <button className="btn btn-o btn-sm" onClick={() => openForm('scaleup')}>+ Note ScaleUp</button>
            <button className="btn btn-o btn-sm" onClick={() => openForm('vehicle')}>+ Contrôle véhicule</button>
          </div>
        </div>
        <div style={{ fontSize: '.72rem', color: 'var(--tm)', padding: '0 14px 10px' }}>
          Échelle : <b>/{cfg.scale}</b> · pondération : {cfg.criteria.map((c) => `${c.label} ${c.weight}%`).join(' · ')} — modifiable dans <b>Paramètres</b>.
        </div>
        <div className="tw">
          <table>
            <thead><tr><th>Date</th><th>Sujet</th><th>Type</th><th>Source</th><th>Note /{cfg.scale}</th><th>Détail critères</th><th>Chauffeur lié</th><th>Commentaire</th><th /></tr></thead>
            <tbody>
              {[...search.filtered].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).map((e) => {
                const scale = e.criteria?.__scale ?? cfg.scale;
                return (
                  <tr key={e.id}>
                    <td>{fd(e.date)}</td><td style={{ fontWeight: 600 }}>{label(e)}</td>
                    <td><span className={`bg ${e.subjectType === 'driver' ? 'bg-t' : 'bg-b'}`}>{e.subjectType === 'driver' ? 'Chauffeur' : 'Véhicule'}</span></td>
                    <td><span className="bg">{e.source === 'responsable' ? 'Responsable' : e.source === 'scaleup' ? 'ScaleUp' : 'Contrôle'}</span></td>
                    <td style={{ fontWeight: 700, color: evalColor(e.score ?? 0, scale) }}>{e.score}</td>
                    <td style={{ fontSize: '.68rem', color: 'var(--tm)' }}>
                      {e.source === 'responsable' && e.criteria
                        ? cfg.criteria.filter((c) => e.criteria[c.key] != null).map((c) => `${c.label.split(' ')[0]} ${e.criteria[c.key]}`).join(' · ')
                        : '—'}
                    </td>
                    <td>{e.relatedDriver ? (drivers.find((d) => d.code === e.relatedDriver)?.name ?? e.relatedDriver) : '—'}</td>
                    <td style={{ fontSize: '.72rem', color: 'var(--tm)' }}>{e.note}</td>
                    <td><button className="btn btn-r btn-sm" onClick={() => remove(e.id)}>Suppr.</button></td>
                  </tr>
                );
              })}
              {!search.filtered.length && <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--tm)', padding: 20 }}>Aucune évaluation</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {form && (
        <Modal open onClose={() => setForm(null)}
          title={form.mode === 'responsable' ? 'Notation par le responsable' : form.mode === 'scaleup' ? 'Note ScaleUp (saisie manuelle)' : 'Contrôle périodique véhicule'}
          footer={<><button className="btn btn-o" onClick={() => setForm(null)}>Annuler</button><button className="btn btn-p" onClick={submit}>Enregistrer</button></>}>
          <div className="form-r">
            <div className="form-g"><label>{form.mode === 'vehicle' ? 'Véhicule' : 'Chauffeur'}</label>
              <select value={form.subjectCode} onChange={(e) => setForm({ ...form, subjectCode: e.target.value })}>
                {form.mode === 'vehicle'
                  ? vehicles.map((v) => <option key={v.code} value={v.code}>{v.code} — {v.brand} {v.model}</option>)
                  : drivers.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
              </select>
            </div>
            <div className="form-g"><label>Date</label><DateInput value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
          </div>

          {form.mode === 'responsable' && (
            <>
              <div style={{ fontSize: '.78rem', fontWeight: 600, margin: '8px 0' }}>Notes par critère (sur {cfg.scale})</div>
              {cfg.criteria.map((c) => (
                <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ minWidth: 160, fontSize: '.78rem' }}>{c.label} <span style={{ color: 'var(--tm)' }}>({c.weight}%)</span></span>
                  <input type="range" min={0} max={cfg.scale} step={cfg.scale === 5 ? 0.5 : 1}
                    value={form.criteria?.[c.key] ?? cfg.scale * 0.7}
                    onChange={(e) => setForm({ ...form, criteria: { ...form.criteria, [c.key]: Number(e.target.value) } })} style={{ flex: 1 }} />
                  <b style={{ minWidth: 34, textAlign: 'right' }}>{form.criteria?.[c.key] ?? Math.round(cfg.scale * 0.7)}</b>
                </div>
              ))}
              <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 'var(--rs)', background: 'var(--g1)', fontWeight: 700 }}>
                Note finale : <span style={{ color: evalColor(previewScore ?? 0, cfg.scale) }}>{previewScore} / {cfg.scale}</span>
              </div>
            </>
          )}

          {form.mode === 'scaleup' && (
            <div className="form-g"><label>Note finale ScaleUp (sur {cfg.scale})</label>
              <input type="number" min={0} max={cfg.scale} step={cfg.scale === 5 ? 0.1 : 0.5} value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} />
            </div>
          )}

          {form.mode === 'vehicle' && (
            <>
              <div className="form-r">
                <div className="form-g"><label>Note /{cfg.scale}</label><input type="number" min={0} max={cfg.scale} value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} /></div>
                <div className="form-g"><label>Chauffeur associé (reçoit aussi la note)</label>
                  <select value={form.relatedDriver ?? ''} onChange={(e) => setForm({ ...form, relatedDriver: e.target.value })}>
                    <option value="">— Aucun —</option>
                    {drivers.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}

          <div className="form-g"><label>Commentaire</label><input value={form.note ?? ''} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
        </Modal>
      )}
    </div>
  );
}
