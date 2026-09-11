'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  useAllKmBreakdowns, useCreateKmReading, useDrivers, useFuelEntries,
  useMaintenanceOrders, useMissions, useMoveTire, useTires, useUpdate, useVehicleAssignments, useVehicles,
} from '@/lib/api/hooks';
import { useBuCcLabel } from '@/components/ui/BuCcSelect';
import { fd, fk } from '@/lib/fleet/format';
import { vhMissionKm } from '@/lib/fleet/consumption';
import Tabs from '@/components/ui/Tabs';
import StatusBadge from '@/components/ui/StatusBadge';
import ExpiryBadge, { expiryStatus } from '@/components/ui/ExpiryBadge';
import Modal from '@/components/ui/Modal';
import VehicleFormModal from '@/components/flotte/VehicleFormModal';
import SearchBox from '@/components/ui/SearchBox';
import DateInput from '@/components/ui/DateInput';
import { useSearch } from '@/lib/useSearch';
import { positionsFor } from '@/lib/reference/tirePositions';
import type { Equipment, Vehicle, VehicleAssignment } from '@/lib/types';

/** Statut effectif d'un document : N/A si l'utilisateur l'a marqué ainsi, sinon calculé sur l'échéance. */
function docStatus(manual: string | null | undefined, expiry: string | null | undefined): string {
  if ((manual ?? '').toUpperCase() === 'N/A') return 'N/A';
  const s = expiryStatus(expiry);
  if (s.kind === 'expired') return 'EXPIRE';
  if (s.kind === 'ok' || s.kind === 'soon') return 'VALIDE';
  return manual || '—';
}

const plus = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
const TYPES = ['all', 'LEGER', 'LOURD', 'ENGIN', 'REMORQUE'] as const;
const TYPE_LABEL: Record<string, string> = { all: 'Tous', LEGER: 'Léger', LOURD: 'Lourd', ENGIN: 'Engin', REMORQUE: 'Remorque' };
const GENRE_LABEL: Record<string, string> = { VIP: 'VIP / berline', CTTE: 'Camionnette', CAM: 'Camion', TR: 'Tracteur routier', ENGIN: 'Engin', REMORQUE: 'Remorque' };
const ownLabel = (o?: string | null) => (o === 'PROPRE' ? 'Propriété' : o === 'LEASING' ? 'Leasing' : 'Location');
const ownClass = (o?: string | null) => (o === 'PROPRE' ? 'bg-g' : o === 'LEASING' ? 'bg-a' : 'bg-b');
const EQUIP_TYPES = ['Roue de secours', 'Extincteur', 'Triangle de signalisation', 'Gilet réfléchissant', 'Trousse premiers secours', 'Antenne radio', 'Kit outillage', 'Bâche de protection', 'Chaînes neige', 'Cric hydraulique', 'Câbles de démarrage', 'Cône de signalisation'];

export default function FlottePage() {
  const [tab, setTab] = useState(0);
  const [filter, setFilter] = useState<string>('all');
  const [formVehicle, setFormVehicle] = useState<Vehicle | null | undefined>(undefined); // undefined=closed, null=create
  const [detail, setDetail] = useState<Vehicle | null>(null);
  const [evalCode, setEvalCode] = useState<string>('');
  const [equipModal, setEquipModal] = useState<{ vehicle: Vehicle; index: number | null } | null>(null);
  const [kmModal, setKmModal] = useState<Vehicle | null>(null);

  const vehicles = useVehicles();
  const drivers = useDrivers();
  const missions = useMissions();
  const fuel = useFuelEntries();
  const maint = useMaintenanceOrders();
  const tires = useTires();
  const assignments = useVehicleAssignments();
  const updateVehicle = useUpdate<Vehicle>('vehicles');
  const createKm = useCreateKmReading();
  const ccLabel = useBuCcLabel();

  const V = vehicles.data ?? [];
  const D = drivers.data ?? [];
  const todayStr = new Date().toISOString().slice(0, 10);
  // Voiture de service = affectation permanente à une personne, active à ce jour (retour DG).
  const serviceCarOf = (code: string): VehicleAssignment | undefined =>
    (assignments.data ?? []).find((a) => a.vehicleCode === code && a.assigneeName
      && (!a.dateEnd || a.dateEnd >= todayStr) && (!a.dateStart || a.dateStart <= todayStr));
  const km = useAllKmBreakdowns(V.map((v) => v.code));
  const kmTotal = (code: string) => km.data?.[code]?.total ?? null;

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: V.length };
    for (const t of ['LEGER', 'LOURD', 'ENGIN', 'REMORQUE']) c[t] = V.filter((v) => v.type === t).length;
    return c;
  }, [V]);

  // Stats rapides (Partie 1) : par type, propres par type, en panne, taux de panne par type.
  const stats = useMemo(() => {
    const types = ['LEGER', 'LOURD', 'ENGIN', 'REMORQUE'];
    return types.map((t) => {
      const all = V.filter((v) => v.type === t);
      const propres = all.filter((v) => v.ownership === 'PROPRE');
      const panne = all.filter((v) => v.status === 'EN_PANNE' || v.status === 'HORS_SERVICE');
      return { type: t, total: all.length, propres: propres.length, panne: panne.length, taux: all.length ? Math.round((panne.length / all.length) * 100) : 0 };
    });
  }, [V]);

  const search = useSearch(V, (v) => [v.code, v.brand, v.model, v.plate, v.type, v.genre, v.status, v.ownership, v.lessor, v.siteBase, v.chassis, v.serviceYear, v.fuel, v.greyCard].join(' '));
  const filtered = (filter === 'all' ? search.filtered : search.filtered.filter((v) => v.type === filter));

  const saveEquipment = async (vehicle: Vehicle, equipment: Equipment[]) => {
    await updateVehicle.mutateAsync({ id: vehicle.code, body: { equipment } });
  };

  return (
    <div className="page active">
      <div className="fb">
        {TYPES.map((t) => (
          <button key={t} className={`fc${filter === t ? ' act' : ''}`} onClick={() => setFilter(t)}>
            {TYPE_LABEL[t]} ({counts[t] ?? 0})
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <SearchBox value={search.q} onChange={search.setQ} placeholder="Code, marque, immat, statut…" count={filtered.length} total={V.length} />
      </div>

      <div className="sg" style={{ marginBottom: 12 }}>
        {stats.map((s) => (
          <div className="sc" key={s.type}>
            <div>
              <div className="sv">{s.total}</div>
              <div className="sl">{TYPE_LABEL[s.type]}</div>
              <div className={`st ${s.panne ? 'dn' : 'up'}`}>
                {s.propres} propres · {s.panne} panne{s.panne > 1 ? 's' : ''} · taux {s.taux}%
              </div>
            </div>
          </div>
        ))}
      </div>

      <Tabs tabs={['Liste Véhicules', 'Documents', 'Pneumatique', 'Équipements', 'Véhicules en panne', 'Fiche Véhicule']} active={tab} onChange={setTab} />

      {tab === 0 && (
        <div className="tpane act">
          <div className="tc">
            <div className="th"><h3>Parc Véhicules ({filtered.length}{search.q || filter !== 'all' ? ` / ${V.length}` : ''})</h3>
              <div><button className="btn btn-p" onClick={() => setFormVehicle(null)}>{plus} Ajouter</button></div>
            </div>
            <div className="tw">
              <table>
                <thead><tr><th>Code</th><th>Marque / Modèle</th><th>Type</th><th>Immat.</th><th>Statut</th><th>Propriété</th><th>Fin Loc.</th><th>Km cumulé</th><th>Carburant</th><th>Norme</th><th>Actions</th></tr></thead>
                <tbody>
                  {filtered.map((v) => {
                    const kt = kmTotal(v.code);
                    const b = km.data?.[v.code];
                    const sc = serviceCarOf(v.code);
                    return (
                      <tr key={v.code} className="clickable" onClick={() => setDetail(v)}>
                        <td>{v.code}</td>
                        <td>{v.brand} {v.model}
                          {(v.siteBase || v.serviceYear) && <div style={{ fontSize: '.6rem', color: 'var(--tm)' }}>{[v.siteBase, v.serviceYear].filter(Boolean).join(' · ')}</div>}
                        </td>
                        <td><span className="bg bg-t">{v.type}</span>{v.genre && <div style={{ fontSize: '.58rem', color: 'var(--tm)', marginTop: 2 }}>{GENRE_LABEL[v.genre] ?? v.genre}</div>}</td>
                        <td>{v.plate}</td>
                        <td><StatusBadge status={v.status} />{v.status === 'EN_PANNE' && <div style={{ fontSize: '.6rem', color: 'var(--r6)' }}>{v.breakdownHours}h panne</div>}
                          {sc && <div style={{ fontSize: '.58rem', color: 'var(--b6)', fontWeight: 700, marginTop: 2 }} title={`Voiture de service — ${sc.assigneeName}`}>Voiture de service</div>}
                        </td>
                        <td><span className={`bg ${ownClass(v.ownership)}`}>{ownLabel(v.ownership)}</span>{v.lessor && <div style={{ fontSize: '.58rem', color: 'var(--tm)', marginTop: 2 }}>{v.lessor}</div>}</td>
                        <td>{fd(v.leaseEnd)}</td>
                        <td title={b ? `base ${fk(b.base)} (${b.baseSource}) + missions ${fk(b.realizedMissions)} + domicile ${fk(b.realizedHome)}` : ''}>
                          {kt != null ? fk(kt) : fk(v.km)}
                        </td>
                        <td>{v.fuel}</td><td>{v.normOff || '—'}</td>
                        <td onClick={(e) => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                          <button className="btn btn-o btn-sm" onClick={() => { setEvalCode(v.code); setTab(5); }}>Fiche</button>{' '}
                          <button className="btn btn-o btn-sm" onClick={() => setKmModal(v)} title="Relevé kilométrique (prélèvement)">Km</button>{' '}
                          <button className="btn btn-o btn-sm" onClick={() => setFormVehicle(v)} title="Modifier (la suppression est dans la fiche)">Modifier</button>
                        </td>
                      </tr>
                    );
                  })}
                  {!filtered.length && <tr><td colSpan={11} style={{ textAlign: 'center', color: 'var(--tm)', padding: 16 }}>Aucun véhicule ne correspond{search.q ? ` à « ${search.q} »` : ''}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 1 && (
        <div className="tpane act">
          <div className="tc">
            <div className="th"><h3>Documents &amp; Assurances</h3><div style={{ fontSize: '.7rem', color: 'var(--tm)' }}>Statut calculé sur l&apos;échéance · pastille ambre = &lt; 60 j · les échéances dépassées / proches génèrent une alerte</div></div>
            <div className="tw">
              <table>
                <thead><tr><th>Véhicule</th><th>CT</th><th>Échéance CT</th><th>Assurance</th><th>Fin assurance</th><th>N° Police</th><th>Carte Grise</th><th>Vignette</th><th>Actions</th></tr></thead>
                <tbody>
                  {filtered.filter((v) => v.ctStatus !== 'N/A' || v.insStatus !== 'N/A').map((v) => (
                    <tr key={v.code} className="clickable">
                      <td>{v.code} — {v.brand} {v.model}</td>
                      <td><StatusBadge status={docStatus(v.ctStatus, v.ctExpiry)} /></td><td><ExpiryBadge expiry={v.ctExpiry} /></td>
                      <td><StatusBadge status={docStatus(v.insStatus, v.insDate)} /></td><td><ExpiryBadge expiry={v.insDate} /></td><td>{v.insPolicy || '—'}</td>
                      <td>{v.greyCard && v.greyCard !== '—' ? <StatusBadge status="VALIDE" /> : '—'}</td>
                      <td>{v.vignette && v.vignette !== '—' ? <StatusBadge status="VALIDE" /> : '—'}</td>
                      <td><button className="btn btn-o btn-sm" onClick={() => setFormVehicle(v)}>Modifier</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 2 && <PneumatiqueTab vehicles={filtered} />}

      {tab === 3 && (
        <EquipmentTab
          vehicles={V}
          onEdit={(vehicle, index) => setEquipModal({ vehicle, index })}
          onRemove={(v, ei) => { const next = (v.equipment ?? []).filter((_, i) => i !== ei); saveEquipment(v, next).then(() => toast.success('Équipement retiré')); }}
        />
      )}

      {tab === 4 && (
        <BrokenVehiclesTab
          vehicles={V}
          maint={maint.data ?? []}
          onUpdate={async (code, body) => { await updateVehicle.mutateAsync({ id: code, body }); toast.success('Panne mise à jour'); }}
          onOpenFiche={(v) => setFormVehicle(v)}
        />
      )}

      {tab === 5 && (
        <div className="tpane act">
          <div style={{ marginBottom: 12 }}>
            <div className="form-g" style={{ maxWidth: 280, marginBottom: 0 }}>
              <label>Sélectionner un véhicule</label>
              <select value={evalCode || V[0]?.code || ''} onChange={(e) => setEvalCode(e.target.value)}>
                {V.map((v) => <option key={v.code} value={v.code}>{v.code} — {v.brand} {v.model}</option>)}
              </select>
            </div>
          </div>
          <EvalCard
            vehicle={V.find((v) => v.code === (evalCode || V[0]?.code)) ?? null}
            missions={missions.data ?? []} fuel={fuel.data ?? []} maint={maint.data ?? []}
            driverName={(code) => D.find((d) => d.code === code)?.name}
          />
        </div>
      )}

      {formVehicle !== undefined && (
        <VehicleFormModal
          open
          onClose={() => setFormVehicle(undefined)}
          vehicle={formVehicle}
          vehicleCount={V.length}
          drivers={D}
        />
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `${detail.code} — ${detail.brand} ${detail.model}` : ''}
        footer={<><button className="btn btn-o" onClick={() => setDetail(null)}>Fermer</button><button className="btn btn-p" onClick={() => { setFormVehicle(detail!); setDetail(null); }}>Modifier</button></>}>
        {detail && <VehicleDetail v={detail} driverName={D.find((d) => d.code === detail.driverCode)?.name}
          serviceCar={serviceCarOf(detail.code)} ccLabel={ccLabel} drName={(c) => D.find((d) => d.code === c)?.name}
          tires={((tires.data ?? []) as MountedTire[]).filter((t) => (t as { currentVehicle?: string | null }).currentVehicle === detail.code && (t as { status?: string }).status === 'monte')} />}
      </Modal>

      {equipModal && (
        <EquipmentModal
          data={equipModal}
          vehicles={V}
          onClose={() => setEquipModal(null)}
          onSave={saveEquipment}
        />
      )}

      {kmModal && (
        <KmReadingModal
          vehicle={kmModal}
          breakdown={km.data?.[kmModal.code]}
          onClose={() => setKmModal(null)}
          onSave={async (km2, note) => {
            await createKm.mutateAsync({ vehicleCode: kmModal.code, date: new Date().toISOString().slice(0, 10), km: km2, note, source: 'manual' });
            toast.success('Relevé kilométrique enregistré');
            setKmModal(null);
          }}
        />
      )}
    </div>
  );
}

function KmReadingModal({ vehicle, breakdown, onClose, onSave }: {
  vehicle: Vehicle;
  breakdown?: import('@/lib/api/client').KmBreakdown;
  onClose: () => void;
  onSave: (km: number, note?: string) => Promise<void>;
}) {
  const [km, setKm] = useState<number>(breakdown?.total ?? vehicle.km ?? 0);
  const [note, setNote] = useState('');
  return (
    <Modal open onClose={onClose} title={`Relevé kilométrique — ${vehicle.code}`}
      footer={<><button className="btn btn-o" onClick={onClose}>Annuler</button><button className="btn btn-p" onClick={() => onSave(Number(km) || 0, note || undefined)}>Enregistrer le prélèvement</button></>}>
      {breakdown && (
        <div style={{ fontSize: '.75rem', color: 'var(--tm)', marginBottom: 12, lineHeight: 1.6 }}>
          Base actuelle : <b>{fk(breakdown.base)} km</b> ({breakdown.baseSource}, {breakdown.baseDate})<br />
          + missions depuis : {fk(breakdown.realizedMissions)} km<br />
          + trajets domicile : {fk(breakdown.realizedHome)} km<br />
          <b style={{ color: 'var(--tp)' }}>Total calculé : {fk(breakdown.total)} km</b>
        </div>
      )}
      <div className="form-g"><label>Nouveau relevé compteur (km) *</label><input type="number" value={km} onChange={(e) => setKm(Number(e.target.value))} /></div>
      <div className="form-g"><label>Note</label><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ex : relevé lors de la maintenance" /></div>
      <div style={{ fontSize: '.68rem', color: 'var(--tm)' }}>
        Ce relevé devient la nouvelle base. Les km des missions terminées et des trajets domicile s&apos;y ajouteront automatiquement.
      </div>
    </Modal>
  );
}

interface MountedTire { id: string; reference: string; brand?: string | null; dimensions?: string | null; serialNumber?: string | null; position?: string | null; mountKm?: number | null; mountDate?: string | null }

function VehicleDetail({ v, driverName, serviceCar, ccLabel, drName, tires = [] }: {
  v: Vehicle; driverName?: string;
  serviceCar?: VehicleAssignment;
  ccLabel?: (bu: string | null | undefined, cc?: string | null) => string;
  drName?: (code: string | null) => string | undefined;
  tires?: MountedTire[];
}) {
  const rows: [string, React.ReactNode][] = [
    ['Type', v.type], ['Genre', v.genre ? (GENRE_LABEL[v.genre] ?? v.genre) : '—'],
    ['Immatriculation', v.plate], ['N° châssis', v.chassis ?? '—'],
    ['Statut', <StatusBadge key="s" status={v.status} />],
    ...(serviceCar ? ([
      ['Voiture de service', <span key="sc" style={{ color: 'var(--b6)', fontWeight: 600 }}>{serviceCar.assigneeName}{serviceCar.structure ? ` — ${serviceCar.structure}` : ''}</span>],
      ['Refacturée à', ccLabel ? ccLabel(serviceCar.businessUnit, serviceCar.costCenter) : (serviceCar.businessUnit ?? '—')],
      ['Chauffeur dédié', serviceCar.withDriver ? (drName?.(serviceCar.driverCode) ?? serviceCar.driverCode ?? 'oui') : 'sans chauffeur (conduite personnelle)'],
      ['Exclue des missions', <span key="ex" className="bg bg-a">Oui — affectée à une personne</span>],
    ] as [string, React.ReactNode][]) : []),
    ['Propriété', v.ownership === 'PROPRE' ? 'Propriété (Amimer Énergie)' : `${ownLabel(v.ownership)}${v.lessor ? ` — ${v.lessor}` : ''}${v.leaseEnd ? ` (fin ${v.leaseEnd})` : ''}`],
    ['Site de rattachement', v.siteBase ?? '—'], ['Année mise en circulation', v.serviceYear ?? '—'],
    ['Puissance fiscale', v.fiscalPower ? `${v.fiscalPower} CV` : '—'],
    ['Personnes transportables', v.seats != null ? `${v.seats} pax` : '—'],
    ['Nombre de pneus', v.tireCount != null ? `${v.tireCount}` : '—'],
    ['Tonnage max (charge utile)', v.maxTonnage != null ? `${v.maxTonnage} t` : '—'],
    ['Plein max', v.tankLiters != null ? `${v.tankLiters} L` : '—'],
    ['Kilométrage', `${fk(v.km)} km`], ['Carburant', v.fuel], ['Norme', `${v.normOff} / ${v.normCorr}`],
    ['Réservoir', `${v.tankLiters} L`], ['CT', v.ctStatus === 'N/A' ? 'N/A' : `échéance ${fd(v.ctExpiry)}`],
    ['Assurance', v.insStatus === 'N/A' ? 'N/A' : `fin ${fd(v.insDate)} · ${v.insPolicy ?? '—'}`],
    ['Chauffeur', driverName ?? 'Aucun'], ['Heures panne', `${v.breakdownHours}h`],
    ...(v.status === 'EN_PANNE' || v.status === 'HORS_SERVICE' ? ([
      ['Prise en charge panne', <span key="b" className={`bg ${bdLabel(v.breakdownStatus).cls}`}>{bdLabel(v.breakdownStatus).label}</span>],
      ['Remise en marche (prév.)', v.repairEta ?? '—'],
    ] as [string, React.ReactNode][]) : []),
  ];
  const positions = positionsFor(v.type);
  const byPos = new Map(tires.map((t) => [t.position ?? '', t]));
  const mounted = tires.length;
  return (
    <div>
      <div className="eval-grid">
        {rows.map(([k, val]) => (
          <div className="eval-item" key={k}><div className="ev-label">{k}</div><div className="ev-val" style={{ fontSize: '.85rem' }}>{val}</div></div>
        ))}
      </div>

      <div className="tc" style={{ marginTop: 14 }}>
        <div className="th">
          <h3>Pneumatiques montés</h3>
          <div className="sub" style={{ fontSize: '.7rem' }}>{v.type} — {positions.length} positions · {mounted} pneu(s) affecté(s)</div>
        </div>
        <div className="tw">
          <table>
            <thead><tr><th>Position</th><th>Pneu</th><th>Marque / Dim.</th><th>N° série</th><th>Km montage</th><th>Depuis</th></tr></thead>
            <tbody>
              {positions.map((pos) => {
                const t = byPos.get(pos);
                return (
                  <tr key={pos}>
                    <td style={{ fontWeight: 600 }}>{pos}</td>
                    {t ? (
                      <>
                        <td>{t.reference}</td>
                        <td>{[t.brand, t.dimensions].filter(Boolean).join(' · ') || '—'}</td>
                        <td>{t.serialNumber ?? '—'}</td>
                        <td>{t.mountKm ? `${fk(t.mountKm)} km` : '—'}</td>
                        <td>{fd(t.mountDate)}</td>
                      </>
                    ) : (
                      <td colSpan={5} style={{ color: 'var(--tm)' }}>— libre —</td>
                    )}
                  </tr>
                );
              })}
              {tires.filter((t) => !positions.includes(t.position ?? '')).map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600, color: 'var(--a6)' }}>{t.position ?? '(sans position)'}</td>
                  <td>{t.reference}</td>
                  <td>{[t.brand, t.dimensions].filter(Boolean).join(' · ') || '—'}</td>
                  <td>{t.serialNumber ?? '—'}</td>
                  <td>{t.mountKm ? `${fk(t.mountKm)} km` : '—'}</td>
                  <td>{fd(t.mountDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function EvalCard({ vehicle: v, missions, fuel, maint, driverName }: {
  vehicle: Vehicle | null;
  missions: import('@/lib/types').Mission[];
  fuel: import('@/lib/types').FuelEntry[];
  maint: import('@/lib/types').MaintenanceOrder[];
  driverName: (code: string | null) => string | undefined;
}) {
  if (!v) return <p style={{ color: 'var(--tm)' }}>Sélectionnez un véhicule</p>;
  const vFu = fuel.filter((f) => f.vehicleCode === v.code);
  const totalL = vFu.reduce((s, f) => s + f.qty, 0);
  const totalKm = vhMissionKm(v.code, missions);
  const avgConso = totalKm > 0 ? ((totalL / totalKm) * 100).toFixed(1) : '—';
  const vMi = missions.filter((m) => m.vehicleCode === v.code);
  const vMt = maint.filter((m) => m.vehicleCode === v.code);
  const mtCost = vMt.reduce((s, m) => s + (m.totalCost ?? 0), 0);
  const fuelCost = vFu.reduce((s, f) => s + f.qty * f.unitPrice, 0);
  const normOk = avgConso !== '—' && (v.normCorr ?? 0) > 0
    ? (parseFloat(avgConso) <= (v.normCorr ?? 0) * 1.15 ? 'CONFORME' : 'HORS NORME')
    : '—';
  const normCls = normOk === 'CONFORME' ? 'bg-g' : normOk === 'HORS NORME' ? 'bg-r' : 'bg-t';

  const items: [string, React.ReactNode, React.ReactNode?][] = [
    ['Kilométrage', `${fk(v.km)} km`],
    ['Km Période', `${fk(totalKm)} km`],
    ['Conso Réelle', `${avgConso} L/100km`, `Norme: ${v.normCorr}`],
    ['Conformité', <span key="c" className={`bg ${normCls}`}>{normOk}</span>],
    ['Litres (mois)', `${fk(totalL)} L`],
    ['Coût Carburant', `${fk(Math.round(fuelCost))} DA`],
    ['Coût Maintenance', `${fk(mtCost)} DA`],
    ['Missions', String(vMi.length), `${vMi.filter((m) => m.status === 'EN_COURS').length} en cours`],
    ['Pannes', `${v.breakdownHours}h`, v.status === 'EN_PANNE' ? 'En panne' : 'OK'],
    ['Chauffeur', driverName(v.driverCode) ?? 'Aucun'],
    ['CT', <StatusBadge key="ct" status={docStatus(v.ctStatus, v.ctExpiry)} />, <ExpiryBadge key="cte" expiry={v.ctExpiry} />],
    ['Assurance', <StatusBadge key="as" status={docStatus(v.insStatus, v.insDate)} />, <ExpiryBadge key="ase" expiry={v.insDate} />],
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16, padding: 16, background: 'var(--sc)', border: '1px solid var(--bd)', borderRadius: 'var(--rad)' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: '"DM Sans",sans-serif' }}>{v.code} — {v.brand} {v.model}</div>
          <div style={{ fontSize: '.78rem', color: 'var(--tm)' }}>{v.type} · {v.plate} · {v.fuel} · {v.ownership === 'PROPRE' ? 'Propriété' : 'Location'}</div>
        </div>
        <StatusBadge status={v.status} />
      </div>
      <div className="eval-grid">
        {items.map(([label, val, sub]) => (
          <div className="eval-item" key={label}>
            <div className="ev-label">{label}</div>
            <div className="ev-val">{val}</div>
            {sub && <div className="ev-sub">{sub}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// Équipements soumis à une date de validité (retour DG : « extincteurs ont date validité »).
const EQUIP_WITH_EXPIRY = ['Extincteur', 'Trousse premiers secours'];

/* ─── Onglet Véhicules en panne (retour DG) ─── */
const BREAKDOWN_STATUS: { value: string; label: string; cls: string }[] = [
  { value: 'non_pris_en_charge', label: 'Non pris en charge', cls: 'bg-r' },
  { value: 'pris_en_charge', label: 'Pris en charge', cls: 'bg-a' },
  { value: 'en_reparation', label: 'En réparation', cls: 'bg-b' },
];
const bdLabel = (s?: string | null) => BREAKDOWN_STATUS.find((x) => x.value === s) ?? BREAKDOWN_STATUS[0];
const OPEN_OT = ['ouvert', 'diagnostic', 'valide', 'en_lancement', 'PLANIFIE', 'EN_COURS'];

function BrokenVehiclesTab({ vehicles, maint, onUpdate, onOpenFiche }: {
  vehicles: Vehicle[];
  maint: import('@/lib/types').MaintenanceOrder[];
  onUpdate: (code: string, body: Partial<Vehicle>) => Promise<void>;
  onOpenFiche: (v: Vehicle) => void;
}) {
  const broken = vehicles.filter((v) => v.status === 'EN_PANNE' || v.status === 'HORS_SERVICE');
  const otOf = (code: string) => maint.find((o) => o.vehicleCode === code && OPEN_OT.includes(o.status ?? ''));
  const byType = ['LEGER', 'LOURD', 'ENGIN', 'REMORQUE'].map((t) => ({ t, n: broken.filter((v) => v.type === t).length })).filter((x) => x.n);
  const byStatus = BREAKDOWN_STATUS.map((s) => ({ ...s, n: broken.filter((v) => (v.breakdownStatus ?? 'non_pris_en_charge') === s.value).length }));

  return (
    <div className="tpane act">
      <div className="sg" style={{ marginBottom: 12 }}>
        <div className="sc"><div><div className="sv">{broken.length}</div><div className="sl">Véhicules en panne / hors service</div><div className="st dn">{byType.map((x) => `${x.n} ${TYPE_LABEL[x.t].toLowerCase()}`).join(' · ') || '—'}</div></div></div>
        {byStatus.map((s) => (
          <div className="sc" key={s.value}><div><div className="sv">{s.n}</div><div className="sl">{s.label}</div></div></div>
        ))}
      </div>

      <div className="tc">
        <div className="th"><h3>Détail des pannes</h3><div style={{ fontSize: '.7rem', color: 'var(--tm)' }}>Statut de prise en charge + date prévisionnelle de remise en marche modifiables ici</div></div>
        <div className="tw">
          <table>
            <thead><tr><th>Véhicule</th><th>Type</th><th>Statut</th><th>Immob.</th><th>Prise en charge</th><th>OT lié</th><th>Remise en marche (prév.)</th><th>Fiche</th></tr></thead>
            <tbody>
              {broken.map((v) => {
                const ot = otOf(v.code);
                return (
                  <tr key={v.code}>
                    <td style={{ fontWeight: 600 }}>{v.code}<div style={{ fontSize: '.62rem', color: 'var(--tm)', fontWeight: 400 }}>{v.brand} {v.model}</div></td>
                    <td><span className="bg bg-t">{v.type}</span></td>
                    <td><StatusBadge status={v.status} /></td>
                    <td>{v.breakdownHours ? `${v.breakdownHours} h` : '—'}</td>
                    <td>
                      <select value={v.breakdownStatus ?? 'non_pris_en_charge'} onChange={(e) => onUpdate(v.code, { breakdownStatus: e.target.value as Vehicle['breakdownStatus'] })}
                        style={{ fontSize: '.72rem', padding: '3px 6px', borderColor: `var(--${bdLabel(v.breakdownStatus).cls.replace('bg-', '')}5)` }}>
                        {BREAKDOWN_STATUS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </td>
                    <td>{ot ? <span className="bg bg-b">{ot.num}</span> : <span style={{ color: 'var(--r6)', fontSize: '.7rem' }}>aucun OT</span>}</td>
                    <td><DateInput value={v.repairEta ?? ''} onChange={(e) => onUpdate(v.code, { repairEta: e.target.value || null })} style={{ fontSize: '.72rem', padding: '3px 6px' }} /></td>
                    <td><button className="btn btn-o btn-sm" onClick={() => onOpenFiche(v)}>Modifier</button></td>
                  </tr>
                );
              })}
              {!broken.length && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--g6)', padding: 20 }}>Aucun véhicule en panne</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function EquipmentTab({ vehicles, onEdit, onRemove }: {
  vehicles: Vehicle[];
  onEdit: (v: Vehicle, index: number | null) => void;
  onRemove: (v: Vehicle, ei: number) => void;
}) {
  const withEquip = vehicles.filter((v) => (v.equipment ?? []).length);
  const [sel, setSel] = useState<string>(withEquip[0]?.code ?? vehicles[0]?.code ?? '');
  const v = vehicles.find((x) => x.code === sel) ?? vehicles[0];

  // Alertes d'expiration sur tout le parc.
  const expiring = vehicles.flatMap((veh) => (veh.equipment ?? []).map((eq, ei) => ({ veh, eq, ei, s: expiryStatus(eq.expiry) })))
    .filter((x) => x.s.kind === 'expired' || x.s.kind === 'soon')
    .sort((a, b) => (a.s.days ?? 0) - (b.s.days ?? 0));

  return (
    <div className="tpane act">
      {expiring.length > 0 && (
        <div className="tc" style={{ marginBottom: 12, borderColor: 'var(--a5)' }}>
          <div className="th"><h3>Équipements à renouveler ({expiring.length})</h3><div style={{ fontSize: '.7rem', color: 'var(--tm)' }}>Validité dépassée ou &lt; 60 jours</div></div>
          <div className="tw"><table>
            <thead><tr><th>Véhicule</th><th>Équipement</th><th>Validité</th></tr></thead>
            <tbody>
              {expiring.map(({ veh, eq, ei, s }) => (
                <tr key={`${veh.code}-${ei}`} className="clickable" onClick={() => { setSel(veh.code); onEdit(veh, ei); }}>
                  <td style={{ fontWeight: 600 }}>{veh.code} — {veh.brand} {veh.model}</td>
                  <td>{eq.nom}</td>
                  <td style={{ color: s.kind === 'expired' ? 'var(--r6)' : 'var(--a6)', fontWeight: 600 }}>
                    {fd(eq.expiry)} · {s.kind === 'expired' ? `expiré depuis ${-s.days!} j` : `expire dans ${s.days} j`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      <div className="tc">
        <div className="th">
          <h3>Équipements par véhicule</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={sel} onChange={(e) => setSel(e.target.value)} style={{ minWidth: 240 }}>
              {vehicles.map((x) => <option key={x.code} value={x.code}>{x.code} — {x.brand} {x.model} ({(x.equipment ?? []).length})</option>)}
            </select>
            <button className="btn btn-p btn-sm" onClick={() => onEdit(v, null)}>{plus} Annexer</button>
          </div>
        </div>
        <div className="tw">
          <table>
            <thead><tr><th>Équipement</th><th>Qté</th><th>État</th><th>Validité</th><th>Notes</th><th>Actions</th></tr></thead>
            <tbody>
              {(v?.equipment ?? []).map((eq, ei) => (
                <tr key={ei} className="clickable" onClick={() => onEdit(v, ei)}>
                  <td style={{ fontWeight: 600 }}>{eq.nom}</td>
                  <td>{eq.qty}</td>
                  <td><span className={`bg ${eq.etat === 'BON' ? 'bg-g' : eq.etat === 'USURE' ? 'bg-a' : 'bg-r'}`}>{eq.etat}</span></td>
                  <td><ExpiryBadge expiry={eq.expiry} /></td>
                  <td>{eq.notes || '—'}</td>
                  <td onClick={(e) => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn btn-o btn-sm" onClick={() => onEdit(v, ei)}>Modifier</button>{' '}
                    <button className="btn btn-r btn-sm" onClick={() => onRemove(v, ei)}>✕</button>
                  </td>
                </tr>
              ))}
              {!(v?.equipment ?? []).length && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--tm)', padding: 20 }}>Aucun équipement pour ce véhicule</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function EquipmentModal({ data, vehicles, onClose, onSave }: {
  data: { vehicle: Vehicle; index: number | null };
  vehicles: Vehicle[];
  onClose: () => void;
  onSave: (v: Vehicle, eq: Equipment[]) => Promise<void>;
}) {
  const existing = data.index != null ? data.vehicle.equipment?.[data.index] : undefined;
  const [vhCode, setVhCode] = useState(data.vehicle.code);
  const [nom, setNom] = useState(existing?.nom ?? EQUIP_TYPES[0]);
  const [qty, setQty] = useState(existing?.qty ?? 1);
  const [etat, setEtat] = useState<Equipment['etat']>(existing?.etat ?? 'BON');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [expiry, setExpiry] = useState(existing?.expiry ?? '');
  const showExpiry = EQUIP_WITH_EXPIRY.some((t) => nom.toLowerCase().includes(t.toLowerCase())) || !!expiry;

  const submit = async () => {
    const target = vehicles.find((v) => v.code === vhCode);
    if (!target) return;
    const list = [...(target.equipment ?? [])];
    const obj: Equipment = { nom, qty: Number(qty) || 1, etat, notes, expiry: expiry || null };
    if (data.index != null && target.code === data.vehicle.code) list[data.index] = obj;
    else list.push(obj);
    await onSave(target, list);
    toast.success(data.index != null ? 'Équipement mis à jour' : `Équipement annexé à ${vhCode}`);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={data.index != null ? 'Modifier Équipement' : 'Annexer Équipement'}
      footer={<><button className="btn btn-o" onClick={onClose}>Annuler</button><button className="btn btn-p" onClick={submit}>Enregistrer</button></>}>
      <div className="form-g"><label>Véhicule</label>
        <select value={vhCode} onChange={(e) => setVhCode(e.target.value)} disabled={data.index != null}>
          {vehicles.map((v) => <option key={v.code} value={v.code}>{v.code} — {v.brand} {v.model}</option>)}
        </select>
      </div>
      <div className="form-r">
        <div className="form-g"><label>Équipement</label>
          <select value={nom} onChange={(e) => setNom(e.target.value)}>{EQUIP_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        </div>
        <div className="form-g"><label>Quantité</label><input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} /></div>
      </div>
      <div className="form-r">
        <div className="form-g"><label>État</label>
          <select value={etat} onChange={(e) => setEtat(e.target.value as Equipment['etat'])}>
            <option value="BON">BON</option><option value="USURE">USURE</option><option value="HS">HS</option>
          </select>
        </div>
        <div className="form-g">
          <label>Date de validité {showExpiry ? '' : <span style={{ color: 'var(--tm)', fontWeight: 400 }}>(si applicable)</span>}</label>
          <DateInput value={expiry} onChange={(e) => setExpiry(e.target.value)} />
        </div>
      </div>
      <div className="form-g"><label>Notes</label><input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      {EQUIP_WITH_EXPIRY.some((t) => nom.toLowerCase().includes(t.toLowerCase())) && !expiry && (
        <div style={{ fontSize: '.68rem', color: 'var(--a6)' }}>{nom} : date de validité recommandée — le système alertera à l&apos;approche de l&apos;expiration.</div>
      )}
    </Modal>
  );
}

/* ─── Onglet Pneumatique : les roues montées + secours de chaque véhicule ─── */
interface TireRow { id: string; reference: string; brand?: string | null; dimensions?: string | null; serialNumber?: string | null; position?: string | null; status?: string | null; currentVehicle?: string | null; mountKm?: number | null; mountDate?: string | null }

function PneumatiqueTab({ vehicles }: { vehicles: Vehicle[] }) {
  const tiresQ = useTires();
  const move = useMoveTire();
  const all = (tiresQ.data ?? []) as TireRow[];
  const stock = all.filter((t) => t.status === 'stock');
  const [cell, setCell] = useState<{ v: Vehicle; pos: string; current: TireRow | null } | null>(null);
  const search = useSearch(vehicles, (v) => [v.code, v.brand, v.model, v.type].join(' '));

  const rollingV = search.filtered.filter((v) => v.type !== 'REMORQUE');
  const maxCols = Math.max(...rollingV.map((v) => positionsFor(v.type).length), 5);

  return (
    <div className="tpane act">
      <div className="tc">
        <div className="th"><h3>Pneumatiques par véhicule</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: '.72rem', color: 'var(--tm)' }}>{stock.length} pneu(s) en stock</span>
            <SearchBox value={search.q} onChange={search.setQ} placeholder="Véhicule…" count={rollingV.length} total={vehicles.filter((v) => v.type !== 'REMORQUE').length} />
          </div>
        </div>
        <div style={{ fontSize: '.72rem', color: 'var(--tm)', padding: '0 14px 8px' }}>
          Cliquer une case : <b>libre</b> → monter un pneu du stock · <b>occupée</b> → transférer / déposer / remplacer. Léger = 4 roues + secours · Lourd = 6 + secours.
        </div>
        <div className="tw" style={{ overflowX: 'auto' }}>
          <table style={{ fontSize: '.7rem' }}>
            <thead><tr>
              <th style={{ minWidth: 150, position: 'sticky', left: 0, background: 'var(--s1)', zIndex: 1 }}>Véhicule</th>
              {Array.from({ length: maxCols }, (_, i) => <th key={i} style={{ minWidth: 110, textAlign: 'center' }}>Position {i + 1}</th>)}
            </tr></thead>
            <tbody>
              {rollingV.map((v) => {
                const positions = positionsFor(v.type);
                const mounted = all.filter((t) => t.currentVehicle === v.code && t.status === 'monte');
                const byPos = new Map(mounted.map((t) => [t.position ?? '', t]));
                return (
                  <tr key={v.code}>
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap', position: 'sticky', left: 0, background: 'var(--s1)', zIndex: 1 }}>
                      {v.code} <span className="bg bg-t" style={{ fontSize: '.55rem' }}>{v.type}</span><br />
                      <span style={{ fontWeight: 400, color: 'var(--tm)', fontSize: '.6rem' }}>{v.brand} {v.model} · {mounted.length}/{positions.length}</span>
                    </td>
                    {Array.from({ length: maxCols }, (_, i) => {
                      const pos = positions[i];
                      if (!pos) return <td key={i} style={{ background: 'var(--b0)' }} />;
                      const t = byPos.get(pos) ?? null;
                      const isSpare = /secours/i.test(pos);
                      return (
                        <td key={i} className="clickable" onClick={() => setCell({ v, pos, current: t })}
                          style={{ textAlign: 'center', padding: 4, border: '1px solid var(--bd)', background: t ? (isSpare ? 'var(--a1)' : 'var(--g1)') : 'transparent', cursor: 'pointer' }}>
                          <div style={{ fontWeight: 600, fontSize: '.6rem', color: 'var(--tm)' }}>{pos}</div>
                          {t ? <>
                            <div style={{ fontWeight: 600 }}>{t.reference}</div>
                            <div style={{ fontSize: '.6rem', color: 'var(--tm)' }}>{t.serialNumber ?? '—'}</div>
                          </> : <div style={{ color: 'var(--tm)' }}>— libre —</div>}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {!rollingV.length && <tr><td colSpan={maxCols + 1} style={{ textAlign: 'center', color: 'var(--tm)', padding: 16 }}>Aucun véhicule</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {cell && (
        <TireCellModal cell={cell} stock={stock} vehicles={vehicles} onClose={() => setCell(null)}
          onMove={async (tireId, body) => { await move.mutateAsync({ id: tireId, body }); toast.success('Mouvement pneu enregistré'); setCell(null); }} />
      )}
    </div>
  );
}

function TireCellModal({ cell, stock, vehicles, onClose, onMove }: {
  cell: { v: Vehicle; pos: string; current: TireRow | null };
  stock: TireRow[]; vehicles: Vehicle[];
  onClose: () => void; onMove: (tireId: string, body: Record<string, unknown>) => Promise<void>;
}) {
  const { v, pos, current } = cell;
  const [action, setAction] = useState<'montage' | 'transfert' | 'depose' | 'rebut'>(current ? 'transfert' : 'montage');
  const [stockTire, setStockTire] = useState(stock[0]?.id ?? '');
  const [toVehicle, setToVehicle] = useState('');
  const [toPos, setToPos] = useState('');
  const [km, setKm] = useState<number | ''>(v.km ?? '');

  const destPositions = toVehicle ? positionsFor(vehicles.find((x) => x.code === toVehicle)?.type ?? 'LEGER') : [];

  const submit = () => {
    if (!current || action === 'montage') {
      // Monter un pneu du stock sur cette position (remplace l'éventuel pneu en place).
      if (!stockTire) { toast.error('Choisir un pneu en stock'); return; }
      onMove(stockTire, { type: 'montage', toVehicle: v.code, position: pos, km: km || undefined, replacedTireId: current?.id });
    } else if (action === 'transfert') {
      if (!toVehicle) { toast.error('Choisir le véhicule destination'); return; }
      onMove(current.id, { type: 'transfert', toVehicle, position: toPos || pos, km: km || undefined });
    } else if (action === 'depose') {
      onMove(current.id, { type: 'depose' });
    } else {
      onMove(current.id, { type: 'rebut' });
    }
  };

  return (
    <Modal open onClose={onClose} title={`${v.code} · position ${pos}`}
      footer={<><button className="btn btn-o" onClick={onClose}>Annuler</button><button className="btn btn-p" onClick={submit}>Valider</button></>}>
      {current
        ? <div style={{ marginBottom: 10, fontSize: '.8rem' }}>Pneu en place : <b>{current.reference}</b> {current.serialNumber ? `(série ${current.serialNumber})` : ''} — {[current.brand, current.dimensions].filter(Boolean).join(' · ') || '—'}</div>
        : <div style={{ marginBottom: 10, fontSize: '.8rem', color: 'var(--tm)' }}>Position libre.</div>}

      <div className="form-g"><label>Action</label>
        <select value={action} onChange={(e) => setAction(e.target.value as typeof action)}>
          <option value="montage">{current ? 'Remplacer par un pneu du stock' : 'Monter un pneu du stock'}</option>
          {current && <option value="transfert">Transférer vers un autre véhicule</option>}
          {current && <option value="depose">Déposer (retour stock/atelier)</option>}
          {current && <option value="rebut">Mettre au rebut</option>}
        </select>
      </div>

      {(action === 'montage') && (
        <>
          <div className="form-g"><label>Pneu en stock à monter</label>
            <select value={stockTire} onChange={(e) => setStockTire(e.target.value)}>
              <option value="">—</option>
              {stock.map((t) => <option key={t.id} value={t.id}>{t.reference} · série {t.serialNumber ?? '—'} · {t.dimensions ?? ''}</option>)}
            </select>
          </div>
          {!stock.length && <div style={{ fontSize: '.72rem', color: 'var(--r6)' }}>Aucun pneu en stock — enregistrer un achat dans Maintenance → Pneumatiques.</div>}
          {current && <div style={{ fontSize: '.72rem', color: 'var(--a6)' }}>Le pneu {current.reference} en place sera déposé (remplacé).</div>}
          <div className="form-g"><label>Km au montage</label><input type="number" value={km} onChange={(e) => setKm(e.target.value === '' ? '' : Number(e.target.value))} /></div>
        </>
      )}

      {action === 'transfert' && (
        <>
          <div className="form-g"><label>Véhicule destination</label>
            <select value={toVehicle} onChange={(e) => { setToVehicle(e.target.value); setToPos(''); }}>
              <option value="">—</option>
              {vehicles.filter((x) => x.code !== v.code && x.type !== 'REMORQUE').map((x) => <option key={x.code} value={x.code}>{x.code} — {x.brand} {x.model} ({x.type})</option>)}
            </select>
          </div>
          <div className="form-g"><label>Position destination</label>
            <select value={toPos} onChange={(e) => setToPos(e.target.value)}>
              <option value="">— (même : {pos})</option>
              {destPositions.map((pp) => <option key={pp} value={pp}>{pp}</option>)}
            </select>
          </div>
          <div className="form-g"><label>Km</label><input type="number" value={km} onChange={(e) => setKm(e.target.value === '' ? '' : Number(e.target.value))} /></div>
        </>
      )}
    </Modal>
  );
}
