'use client';

import { Suspense, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import {
  getMissionOrdre, geoRoute, searchPlaces, createPlace,
  useBusinessUnits, useConfig, useConfirmedRemove, useCreate, useDrivers, useGpsPositions,
  useCloturerMission, useCloturerTerminees, useGroupableDpc, useMaintenanceOrders, useMissionGroupPreview,
  useMissionPhase, useMissions, useNotifications, useProposal, useQualifications, useUpdate,
  useValidateMission, useVehicleAssignments, useVehicles,
} from '@/lib/api/hooks';
import { api } from '@/lib/api/client';
import Tabs from '@/components/ui/Tabs';
import StatusBadge from '@/components/ui/StatusBadge';
import Modal from '@/components/ui/Modal';
import PlaceInput from '@/components/ui/PlaceInput';
import DateInput from '@/components/ui/DateInput';
import { useSiteNames, withCurrentSite } from '@/lib/reference/sites';
import NotificationsPanel from '@/components/missions/NotificationsPanel';

const MissionMap = dynamic(() => import('@/components/map/FleetMap'), {
  ssr: false,
  loading: () => <div style={{ height: 300, display: 'grid', placeItems: 'center', color: 'var(--tm)', fontSize: '.75rem' }}>Chargement de la carte…</div>,
});
import { printHTML } from '@/lib/export';
import { fd, fk } from '@/lib/fleet/format';
import { calcFraisMission, type BaremeMission } from '@/lib/fleet/bareme';
import { gpsCalc } from '@/lib/fleet/gps';
import type { BusinessUnit, Mission, Vehicle } from '@/lib/types';

const NEXT_STATUS: Record<string, string> = { PLANIFIEE: 'EN_COURS', EN_COURS: 'TERMINEE', TERMINEE: 'CLOTUREE' };
const NEXT_LABEL: Record<string, string> = { PLANIFIEE: 'Démarrer', EN_COURS: 'Terminer', TERMINEE: 'Clôturer' };
const selStyle: React.CSSProperties = { padding: '6px 8px', border: '1px solid var(--bd)', borderRadius: 'var(--rs)', fontSize: '.75rem', background: 'var(--s1)', color: 'var(--tp)' };

export default function MissionsPage() {
  return (
    <Suspense fallback={<div className="page active" style={{ padding: 40, color: 'var(--tm)' }}>Chargement…</div>}>
      <MissionsPageInner />
    </Suspense>
  );
}

function MissionsPageInner() {
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [fVh, setFVh] = useState('');
  const [fDr, setFDr] = useState('');
  const [detail, setDetail] = useState<Mission | null>(null);
  const [form, setForm] = useState<Mission | null | undefined>(undefined);

  const missions = useMissions();
  const vehicles = useVehicles();
  const drivers = useDrivers();
  const maintOrders = useMaintenanceOrders();
  const assignments = useVehicleAssignments();
  const bus = useBusinessUnits();
  const quals = useQualifications();
  const bareme = useConfig<BaremeMission>('BAREME_MISSION');
  const updateMission = useUpdate<Mission>('missions');
  const cloturerMission = useCloturerMission();
  const cloturerTerminees = useCloturerTerminees();
  const createMission = useCreate<Mission>('missions');
  const removeMission = useConfirmedRemove('missions', 'cette mission');
  const validateMission = useValidateMission();
  const missionPhase = useMissionPhase();

  const router = useRouter();
  const searchParams = useSearchParams();
  const [prefill, setPrefill] = useState<Partial<Mission> | null>(null);
  const [pecId, setPecId] = useState<string | null>(null);
  const [dpcCode, setDpcCode] = useState<string | null>(null);

  // Demande de prise en charge validée → on arrive ici pour compléter la mission.
  useEffect(() => {
    const id = searchParams.get('pec');
    if (!id || pecId === id) return;
    setPecId(id);
    api.get(`/pec-requests/${id}`).then(({ data: r }) => {
      const maxN = Math.max(0, ...(missions.data ?? []).map((m) => parseInt(m.num.split('-')[2] || '0')));
      setPrefill({
        num: `M-${new Date().getFullYear()}-${String(maxN + 1).padStart(4, '0')}`,
        fromLoc: r.fromLoc, toLoc: r.toLoc,
        dateStart: r.dateAller ?? new Date().toISOString().slice(0, 10),
        dateEnd: r.dateRetour ?? r.dateAller ?? null,
        timeStart: '07:00', timeEnd: '17:00', status: 'PLANIFIEE', zone: 'Locale',
        waypoints: [], retType: 'symetrique',
        requiredQual: 'Transport Personnes', qualityCriteria: 'Produits sensibles',
        fraisApplicable: r.fraisApplicable ?? null,
        pecRef: r.ref,
        ca: `PEC ${r.ref} — ${r.organisation ?? ''} / ${r.requesterName ?? ''} (${r.pax ?? '?'} pax)`,
      });
      setForm(null);
    }).catch(() => toast.error('Demande PEC introuvable'));
  }, [searchParams, missions.data, pecId]);

  // Demande DPC interne validée → compléter la mission (véhicule + chauffeur obligatoires).
  useEffect(() => {
    const code = searchParams.get('dpc');
    if (!code || dpcCode === code) return;
    setDpcCode(code);
    api.get(`/dpc-requests/${code}`).then(({ data: d }) => {
      const maxN = Math.max(0, ...(missions.data ?? []).map((m) => parseInt(m.num.split('-')[2] || '0')));
      setPrefill({
        num: `M-${new Date().getFullYear()}-${String(maxN + 1).padStart(4, '0')}`,
        fromLoc: d.depAller ?? '', toLoc: d.destAller ?? '',
        dateStart: d.dateAller ?? new Date().toISOString().slice(0, 10),
        dateEnd: d.dateRetour ?? d.dateAller ?? null,
        timeStart: '07:00', timeEnd: '17:00', status: 'PLANIFIEE', zone: 'Locale',
        waypoints: [], retType: d.dateRetour ? 'symetrique' : 'aucun',
        bu: d.bu ?? null, ca: d.notes ?? null, dpcRef: d.code, dpcRefs: [d.code],
        pax: d.pax ?? null,
        tonnage: (d as { tonnage?: number }).tonnage ?? null,
      });
      setForm(null);
    }).catch(() => toast.error('Demande DPC introuvable'));
  }, [searchParams, missions.data, dpcCode]);

  // Affectation véhicule (voiture d'un responsable) → créer une mission pré-remplie.
  const [assignSeen, setAssignSeen] = useState(false);
  useEffect(() => {
    if (assignSeen) return;
    const vehicle = searchParams.get('vehicle');
    if (!vehicle || searchParams.get('pec') || searchParams.get('dpc')) return;
    setAssignSeen(true);
    const maxN = Math.max(0, ...(missions.data ?? []).map((m) => parseInt(m.num.split('-')[2] || '0')));
    const today = new Date().toISOString().slice(0, 10);
    setPrefill({
      num: `M-${new Date().getFullYear()}-${String(maxN + 1).padStart(4, '0')}`,
      vehicleCode: vehicle, driverCode: searchParams.get('driver') ?? null,
      bu: searchParams.get('bu') ?? null, site: searchParams.get('site') ?? null,
      fromLoc: '', toLoc: searchParams.get('to') ?? '', status: 'PLANIFIEE', zone: 'Locale',
      dateStart: today, dateEnd: today, timeStart: '07:00', timeEnd: '17:00',
      waypoints: [], retType: 'symetrique',
      qualityCriteria: searchParams.get('note') ?? undefined,
    });
    setForm(null);
  }, [searchParams, missions.data, assignSeen]);

  const printOrdre = async (num: string) => {
    try {
      const o = await getMissionOrdre(num);
      const wp = (o.waypoints ?? []).length ? `<tr><td>Étapes</td><td>${o.waypoints.join(' → ')}</td></tr>` : '';
      printHTML(`Ordre de mission ${o.num}`, `
        <h1>Ordre de Mission ${o.num}</h1>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px">
          <table class="info" style="flex:1">
            <tr><td>Chauffeur</td><td>${o.driver?.name ?? o.driver?.code ?? '—'} ${o.driver?.phone ? `(${o.driver.phone})` : ''}</td></tr>
            <tr><td>Véhicule</td><td>${o.vehicle?.code ?? '—'} ${o.vehicle?.brand ?? ''} ${o.vehicle?.model ?? ''} — ${o.vehicle?.plate ?? ''}</td></tr>
            <tr><td>Trajet</td><td><b>${o.fromLoc} → ${o.toLoc}</b></td></tr>
            ${wp}
            <tr><td>Départ</td><td>${fd(o.dateStart)} ${o.timeStart ?? ''}</td></tr>
            <tr><td>Retour</td><td>${fd(o.dateEnd)} ${o.timeEnd ?? ''}</td></tr>
            <tr><td>Durée estimée</td><td>${o.dureeH ?? '—'} h</td></tr>
            <tr><td>Distance</td><td>${o.distance} km (aller ${o.dAller ?? '—'} / retour ${o.dRetour ?? '—'})</td></tr>
            <tr><td>Zone</td><td>${o.zone ?? '—'}</td></tr>
            <tr><td>BU / CA</td><td>${o.bu ?? '—'} / ${o.ca ?? '—'}</td></tr>
            <tr><td>Site / Chantier</td><td>${o.site ?? '—'}</td></tr>
            <tr><td>Qualification requise</td><td>${o.requiredQual ?? 'Aucune'}</td></tr>
          </table>
          <div style="text-align:center"><img src="${o.qr}" width="150" height="150" /><div style="font-size:10px;color:#888">Scanner pour vérifier<br/>l'authenticité</div></div>
        </div>
        <p style="margin-top:30px;font-size:12px">Signature responsable logistique : ______________________</p>`);
    } catch { toast.error('Impossible de générer l’ordre de mission'); }
  };

  const MI = missions.data ?? [];
  const V = vehicles.data ?? [];
  const D = drivers.data ?? [];
  const B = bareme.data;
  const drName = (c: string | null) => D.find((d) => d.code === c)?.name ?? c ?? '—';

  // Onglets = cycle de vie de la mission (retour DG : à valider → planifiée → démarrée → à clôturer → clôturée).
  const isToValidate = (m: Mission) => m.status === 'PLANIFIEE' && m.officeValidated !== true;
  const isPlanned = (m: Mission) => m.status === 'PLANIFIEE' && m.officeValidated === true;
  const isToClose = (m: Mission) => m.status === 'TERMINEE' || (m.status === 'EN_COURS' && !!m.clotureSuggested);
  const counts = {
    all: MI.length,
    tovalidate: MI.filter(isToValidate).length,
    planned: MI.filter(isPlanned).length,
    started: MI.filter((m) => m.status === 'EN_COURS').length,
    toclose: MI.filter(isToClose).length,
    closed: MI.filter((m) => m.status === 'CLOTUREE').length,
    mp: MI.filter((m) => (m.waypoints?.length ?? 0) > 0).length,
  };

  const list = useMemo(() => {
    const byFilter: Record<string, (m: Mission) => boolean> = {
      all: () => true,
      tovalidate: isToValidate,
      planned: isPlanned,
      started: (m) => m.status === 'EN_COURS',
      toclose: isToClose,
      closed: (m) => m.status === 'CLOTUREE',
      mp: (m) => (m.waypoints?.length ?? 0) > 0,
    };
    let l = MI.filter(byFilter[filter] ?? (() => true));
    if (fVh) l = l.filter((m) => m.vehicleCode === fVh);
    if (fDr) l = l.filter((m) => m.driverCode === fDr);
    if (q) {
      const s = q.toLowerCase();
      l = l.filter((m) => `${m.num}${m.vehicleCode}${drName(m.driverCode)}${m.fromLoc}${m.toLoc}${m.bu ?? ''}${m.ca ?? ''}`.toLowerCase().includes(s));
    }
    return l;
  }, [MI, filter, fVh, fDr, q, D]);

  // Ressources indisponibles à ne pas proposer pour une mission.
  const repairVehCodes = useMemo(() => new Set(
    (maintOrders.data ?? [])
      .filter((o) => ['ouvert', 'diagnostic', 'valide', 'en_lancement'].includes(o.status ?? '') && (o.type ?? '').toLowerCase().startsWith('curat'))
      .map((o) => o.vehicleCode),
  ), [maintOrders.data]);
  const vehBlocked = (v: Vehicle) =>
    ['EN_PANNE', 'HORS_SERVICE', 'EN_MAINTENANCE', 'EN_ENTRETIEN'].includes(v.status ?? '') || repairVehCodes.has(v.code);
  // Voitures de service : affectées en permanence à une personne (retour DG) → jamais proposées
  // pour une mission (sinon « voitures affectées mais non déclarées »).
  const serviceCarByCode = useMemo(() => {
    const t = new Date().toISOString().slice(0, 10);
    const m = new Map<string, { assigneeName: string; structure: string | null }>();
    for (const a of assignments.data ?? []) {
      if (a.vehicleCode && a.assigneeName && (!a.dateEnd || a.dateEnd >= t) && (!a.dateStart || a.dateStart <= t)) {
        m.set(a.vehicleCode, { assigneeName: a.assigneeName, structure: a.structure });
      }
    }
    return m;
  }, [assignments.data]);
  const drvUnavailable = (code: string | null) => {
    const d = D.find((x) => x.code === code);
    return !!d && ['EN_REPOS', 'EN_CONGE', 'CONGE', 'INDISPONIBLE', 'ABSENT'].includes(d.status ?? '');
  };

  const apiErr = (e: unknown) =>
    (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erreur';

  const advance = async (m: Mission) => {
    const next = NEXT_STATUS[m.status];
    if (!next) return;
    try {
      if (next === 'CLOTUREE') {
        const f = B ? calcFraisMission(m, B, V) : null;
        await cloturerMission.mutateAsync({
          num: m.num,
          frais: f ? { frais: f.total, fraisDetail: f.lines, fraisCat: f.cat, fraisZone: f.zoneBareme } : undefined,
        });
        toast.success(`Mission ${m.num} clôturée — frais figés`);
        return;
      }
      if (next === 'EN_COURS') {
        await missionPhase.mutateAsync({ num: m.num, phase: 'start' });
        toast.success(`Mission ${m.num} démarrée — ordre de mission émis et transmis au chauffeur`);
        return;
      }
      if (next === 'TERMINEE') {
        await missionPhase.mutateAsync({ num: m.num, phase: 'finish' });
        toast.success(`Mission ${m.num} terminée — à clôturer`);
        return;
      }
      await updateMission.mutateAsync({ id: m.num, body: { status: next as Mission['status'] } });
      toast.success(`Mission ${m.num} → ${next}`);
    } catch (e) {
      toast.error(apiErr(e));
    }
  };

  return (
    <div className="page active">
      <Tabs tabs={['Missions', 'Frais de Mission', 'Notifications']} active={tab} onChange={setTab} />

      {tab === 0 && (
        <div className="tpane act">
          <div className="fb">
            <button className={`fc${filter === 'all' ? ' act' : ''}`} onClick={() => setFilter('all')}>Toutes ({counts.all})</button>
            <button className={`fc${filter === 'tovalidate' ? ' act' : ''}`} onClick={() => setFilter('tovalidate')} style={counts.tovalidate ? { color: 'var(--r6)', fontWeight: 700 } : undefined}>À valider ({counts.tovalidate})</button>
            <button className={`fc${filter === 'planned' ? ' act' : ''}`} onClick={() => setFilter('planned')}>Planifiées ({counts.planned})</button>
            <button className={`fc${filter === 'started' ? ' act' : ''}`} onClick={() => setFilter('started')}>Démarrées ({counts.started})</button>
            <button className={`fc${filter === 'toclose' ? ' act' : ''}`} onClick={() => setFilter('toclose')} style={counts.toclose ? { color: 'var(--a6)', fontWeight: 700 } : undefined}>À clôturer ({counts.toclose})</button>
            <button className={`fc${filter === 'closed' ? ' act' : ''}`} onClick={() => setFilter('closed')}>Clôturées ({counts.closed})</button>
            <button className={`fc${filter === 'mp' ? ' act' : ''}`} onClick={() => setFilter('mp')}>Multipoint ({counts.mp})</button>
            <div style={{ flex: 1 }} />
            <button className="btn btn-p" onClick={() => setForm(null)}>+ Nouvelle Mission</button>
          </div>
          <div style={{ margin: '6px 0', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input placeholder="Rechercher mission, véhicule, chauffeur, trajet…" value={q} onChange={(e) => setQ(e.target.value)}
              style={{ flex: 1, minWidth: 200, padding: '6px 10px', border: '1px solid var(--bd)', borderRadius: 'var(--rs)', fontSize: '.78rem', background: 'var(--s1)', color: 'var(--tp)' }} />
            <select value={fVh} onChange={(e) => setFVh(e.target.value)} style={selStyle}><option value="">Tous véhicules</option>{V.map((v) => <option key={v.code} value={v.code}>{v.code}</option>)}</select>
            <select value={fDr} onChange={(e) => setFDr(e.target.value)} style={selStyle}><option value="">Tous chauffeurs</option>{D.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}</select>
          </div>
          <div id="miList">
            {list.map((m) => {
              const isMP = (m.waypoints?.length ?? 0) > 0;
              return (
                <div className={`mc${isMP ? ' multipoint' : ''}`} key={m.num} onClick={() => setDetail(m)}>
                  <div style={{ minWidth: 100 }}>
                    <div style={{ fontWeight: 600, fontSize: '.78rem' }}>{m.num}</div>
                    {isMP && <span className="bg bg-mp" style={{ fontSize: '.55rem' }}>MP {m.waypoints!.length} pts</span>}
                    <div style={{ fontSize: '.68rem', color: 'var(--tm)' }}>{fd(m.dateStart)} {m.timeStart}</div>
                    <div style={{ fontSize: '.68rem', color: 'var(--tm)' }}>→ {fd(m.dateEnd)} {m.timeEnd}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '.78rem', fontWeight: 500, color: 'var(--tp)' }}>{m.fromLoc}</div>
                    {isMP && <div style={{ fontSize: '.65rem', color: 'var(--mp)' }}>via {m.waypoints!.join(' → ')}</div>}
                    <div style={{ fontSize: '.7rem', color: 'var(--tm)' }}>→ {m.toLoc}</div>
                    {(m.dpcRef || m.pecRef) && <div style={{ marginTop: 3 }}><span className="bg bg-b" style={{ fontSize: '.6rem' }}>DPC {m.dpcRef ?? m.pecRef}</span></div>}
                  </div>
                  <div className="mm">
                    <div><div className="mml">Chauffeur</div><div className="mmv">{drName(m.driverCode)}</div></div>
                    <div><div className="mml">Véhicule</div><div className="mmv">{m.vehicleCode || '—'}</div></div>
                    <div><div className="mml">Distance</div><div className="mmv">{fk(m.distance)} km</div></div>
                    <div>
                      <StatusBadge status={m.status} />
                      {m.status === 'PLANIFIEE' && m.officeValidated !== true && <div style={{ fontSize: '.55rem', color: 'var(--r6)', fontWeight: 700, marginTop: 2 }}>À VALIDER</div>}
                      {m.status === 'PLANIFIEE' && m.officeValidated === true && <div style={{ fontSize: '.55rem', color: 'var(--b6)', fontWeight: 700, marginTop: 2 }}>PLANIFIÉE ✓</div>}
                      {m.status === 'TERMINEE' && !m.clotureSuggested && <div style={{ fontSize: '.55rem', color: 'var(--a6)', fontWeight: 700, marginTop: 2 }}>À CLÔTURER</div>}
                      {m.clotureSuggested && m.status !== 'CLOTUREE' && <div style={{ fontSize: '.55rem', color: 'var(--r6)', fontWeight: 700, marginTop: 2 }}>À CLÔTURER (J+1)</div>}
                      {m.autoClotured && <div style={{ fontSize: '.55rem', color: 'var(--a5)', marginTop: 2 }}>auto J+1</div>}
                      {m.fraisApplicable === false && <div style={{ fontSize: '.55rem', color: 'var(--g6)', marginTop: 2 }}>sans frais</div>}
                      {m.fraisApplicable === true && <div style={{ fontSize: '.55rem', color: 'var(--a5)', marginTop: 2 }}>avec frais</div>}
                    </div>
                    {m.status === 'PLANIFIEE' && m.officeValidated !== true && (
                      <button className="btn btn-sm btn-p" disabled={!m.bu || !m.ca}
                        title={!m.bu || !m.ca ? 'Renseigne la BU + le centre de coût (Modifier) avant de valider' : 'Valider la mission planifiée'}
                        onClick={(e) => { e.stopPropagation(); validateMission.mutate(m.num, { onSuccess: () => toast.success(`Mission ${m.num} validée`), onError: (err) => toast.error(apiErr(err)) }); }}>Valider</button>
                    )}
                    {m.status !== 'CLOTUREE' && !(m.status === 'PLANIFIEE' && m.officeValidated !== true) && (
                      <button className={`btn btn-sm ${m.status === 'PLANIFIEE' ? 'btn-p' : m.status === 'EN_COURS' ? 'btn-g' : 'btn-o'}`}
                        onClick={(e) => { e.stopPropagation(); advance(m); }}>{NEXT_LABEL[m.status]}</button>
                    )}
                    <button className="btn btn-o btn-sm" title="Ordre de mission" onClick={(e) => { e.stopPropagation(); printOrdre(m.num); }}>Imprimer</button>
                    {m.status === 'CLOTUREE'
                      ? <span className="bg" title="Mission clôturée — lecture seule" style={{ fontSize: '.6rem' }}>clôturée</span>
                      : <>
                          <button className="btn btn-o btn-sm" title="Modifier la mission" onClick={(e) => { e.stopPropagation(); setForm(m); }}>Modifier</button>
                          <button className="btn btn-r btn-sm" onClick={(e) => { e.stopPropagation(); removeMission(m.num, m.num); }}></button>
                        </>}
                  </div>
                </div>
              );
            })}
            {!list.length && <div style={{ padding: 40, textAlign: 'center', color: 'var(--tm)' }}>Aucune mission</div>}
          </div>
        </div>
      )}

      {tab === 1 && <FraisTab missions={MI} vehicles={V} bareme={B} drName={drName} onOpen={setDetail}
        onCloturerTerminees={async () => {
          const terminees = MI.filter((m) => m.status === 'TERMINEE');
          if (!terminees.length) { toast('Aucune mission terminée à clôturer'); return; }
          const fraisByNum: Record<string, { frais: number; fraisDetail: unknown; fraisCat: string; fraisZone: string }> = {};
          if (B) terminees.forEach((m) => { const f = calcFraisMission(m, B, V); fraisByNum[m.num] = { frais: f.total, fraisDetail: f.lines, fraisCat: f.cat, fraisZone: f.zoneBareme }; });
          const r = await cloturerTerminees.mutateAsync(fraisByNum);
          toast.success(`${r.closed} mission(s) clôturée(s) — frais figés`);
        }} pending={cloturerTerminees.isPending} />}

      {tab === 2 && <NotificationsPanel />}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `Mission ${detail.num}` : ''} wide expandable
        footer={detail && <><button className="btn btn-o" onClick={() => setDetail(null)}>Fermer</button><button className="btn btn-p" onClick={() => printOrdre(detail.num)}>Ordre de mission</button></>}>
        {detail && B && <MissionDetail m={detail} vehicles={V} bareme={B} drName={drName} />}
      </Modal>

      {form !== undefined && B && (
        <MissionFormModal
          mission={form} prefill={prefill} missions={MI} vehicles={V} drivers={D} businessUnits={bus.data ?? []} bareme={B}
          qualifications={(quals.data ?? []) as { code: string; label: string }[]}
          vehBlocked={vehBlocked} drvUnavailable={drvUnavailable} serviceCarByCode={serviceCarByCode}
          onClose={() => { setForm(undefined); setPrefill(null); if (pecId || dpcCode) { setPecId(null); setDpcCode(null); router.replace('/missions'); } }}
          onCreate={async (body) => {
            await createMission.mutateAsync(body);
            // Les demandes DPC groupées sont passées en TRANSFORMEE par le serveur.
            if (pecId) {
              await api.patch(`/pec-requests/${pecId}`, { status: 'en_mission', missionRef: body.num });
              toast.success(`Mission ${body.num} créée — demande PEC clôturée`);
            } else if ((body.dpcRefs ?? []).length > 1) {
              toast.success(`Mission ${body.num} créée — ${(body.dpcRefs ?? []).length} demandes groupées`);
            } else if (dpcCode || (body.dpcRefs ?? []).length === 1) {
              toast.success(`Mission ${body.num} créée — demande transformée`);
            } else toast.success(`Mission ${body.num} créée`);
            qc.invalidateQueries({ queryKey: ['dpc-requests'] });
          }}
          onUpdate={async (num, body) => { await updateMission.mutateAsync({ id: num, body }); toast.success(`Mission ${num} mise à jour`); }}
        />
      )}
    </div>
  );
}

function MissionDetail({ m, vehicles, bareme, drName }: { m: Mission; vehicles: Vehicle[]; bareme: BaremeMission; drName: (c: string | null) => string }) {
  const bus = useBusinessUnits();
  const assignments = useVehicleAssignments();
  const svcCar = m.vehicleCode
    ? (assignments.data ?? []).find((a) => a.vehicleCode === m.vehicleCode && a.assigneeName && a.kind === 'permanent')
    : null;
  const buLabel = (raw: string | null | undefined) => {
    const s = (raw ?? '').trim();
    if (!s) return '—';
    const hit = (bus.data ?? []).find((b) => b.code === s || b.name.toLowerCase() === s.toLowerCase());
    return hit ? hit.name : s;
  };
  const f = calcFraisMission(m, bareme, vehicles);
  const gps = useGpsPositions(false); // positions estimées = missions EN_COURS uniquement
  const est = m.status === 'EN_COURS' ? (gps.data ?? []).filter((p: { missionNum: string }) => p.missionNum === m.num) : [];
  const wp = m.waypoints ?? [];
  return (
    <div>
      <div className="eval-grid" style={{ marginBottom: 12 }}>
        {([
          ['Trajet', `${m.fromLoc} → ${m.toLoc}`], ['Chauffeur', drName(m.driverCode)],
          ['Véhicule', svcCar
            ? <span key="v">{m.vehicleCode} <span style={{ color: 'var(--a6)', fontSize: '.72rem', fontWeight: 600 }}>· emprunt voiture de service ({svcCar.assigneeName})</span></span>
            : (m.vehicleCode || '—')],
          ['Dates', `${fd(m.dateStart)} ${m.timeStart} → ${fd(m.dateEnd)} ${m.timeEnd}`],
          ['Distance', m.retType === 'aucun'
            ? `${fk(m.dAller ?? m.distance)} km (aller simple)`
            : `${fk(m.dAller ?? Math.round((m.distance ?? 0) / 2))} km aller · ${fk(m.distance)} km aller-retour`],
          ['Zone', m.zone ?? '—'], ['Statut', <StatusBadge key="s" status={m.status} />],
          ['BU / CA', `${buLabel(m.bu)} / ${m.ca ?? '—'}`],
          ['Site / Chantier', m.site ?? '—'],
          ['Personnes transportées', m.pax != null && m.pax > 0
            ? `${m.pax}${(() => { const v = vehicles.find((x) => x.code === m.vehicleCode); return v?.seats != null ? ` / ${v.seats} places (${v.code})` : ''; })()}`
            : '—'],
          ['Tonnage requis', m.tonnage != null && m.tonnage > 0
            ? `${m.tonnage} t${(() => { const v = vehicles.find((x) => x.code === m.vehicleCode); return v?.maxTonnage != null ? ` / ${v.maxTonnage} t (${v.code})` : ''; })()}`
            : '—'],
          ['N° DPC / PEC', (m.dpcRefs && m.dpcRefs.length) ? m.dpcRefs.join(' + ') : (m.dpcRef ?? m.pecRef ?? '—')],
          ['Retour', m.retType === 'different' ? `différent (${fk(m.dRetour)} km)` : m.retType === 'aucun' ? 'aller simple' : `= aller (${fk(m.dRetour)} km)`],
        ] as [string, React.ReactNode][]).map(([k, v]) => (
          <div className="eval-item" key={k}><div className="ev-label">{k}</div><div className="ev-val" style={{ fontSize: '.82rem' }}>{v}</div></div>
        ))}
      </div>

      {m.costSplit && m.costSplit.length >= 2 && (
        <div className="tc" style={{ marginBottom: 12 }}>
          <div className="th">
            <h3>Demandes groupées — répartition des frais</h3>
            <div className="sub">{m.costSplit.length} demandes sur le même axe · trajet {m.fromLoc} → {(m.waypoints ?? []).join(' → ')}{(m.waypoints ?? []).length ? ' → ' : ''}{m.toLoc}</div>
          </div>
          <table style={{ width: '100%', fontSize: '.72rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--bd)', color: 'var(--tm)', textAlign: 'left' }}>
                <th style={{ padding: '6px 10px' }}>Demande</th>
                <th style={{ padding: '6px 10px' }}>BU / Structure</th>
                <th style={{ padding: '6px 10px', textAlign: 'right' }}>Pers.</th>
                <th style={{ padding: '6px 10px', textAlign: 'right' }}>Km à bord</th>
                <th style={{ padding: '6px 10px', textAlign: 'right' }}>Part des frais</th>
              </tr>
            </thead>
            <tbody>
              {m.costSplit.map((s) => (
                <tr key={s.dpcCode} style={{ borderBottom: '1px solid var(--bl)' }}>
                  <td style={{ padding: '6px 10px', fontWeight: 600 }}>{s.dpcCode}</td>
                  <td style={{ padding: '6px 10px' }}>{buLabel(s.bu)}{s.structure ? <span style={{ color: 'var(--tm)' }}> · {s.structure}</span> : null}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right' }}>{s.pax}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right' }}>{fk(s.segmentKm)}{s.roundTrip ? ' ×2' : ''}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--b6)' }}>{s.sharePct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '8px 10px', fontSize: '.68rem', color: 'var(--tm)' }}>
            Répartition = personnes transportées × distance réellement parcourue à bord (aller-retour compté double). Détail chiffré dans Facturation BU.
          </div>
        </div>
      )}

      {m.comment && (
        <div style={{ marginBottom: 12, padding: '8px 12px', borderRadius: 'var(--rs)', background: 'var(--a0)', border: '1px solid var(--a5)', fontSize: '.78rem' }}>
          <b style={{ color: 'var(--a6)' }}>Commentaire :</b> {m.comment}
        </div>
      )}
      {m.status === 'CLOTUREE' && (
        <div style={{ marginBottom: 12, padding: '6px 12px', borderRadius: 'var(--rs)', background: 'var(--g1)', color: 'var(--g6)', fontSize: '.75rem', fontWeight: 600 }}>
          Mission clôturée le {m.fraisDateConfirm} — frais figés, non modifiable.
        </div>
      )}
      {m.clotureSuggested && m.status !== 'CLOTUREE' && (
        <div style={{ marginBottom: 12, padding: '6px 12px', borderRadius: 'var(--rs)', background: 'var(--r1)', color: 'var(--r6)', fontSize: '.75rem', fontWeight: 600 }}>
          Fin théorique dépassée (J+1) — à clôturer.
        </div>
      )}

      <div className="tc" style={{ marginBottom: 12 }}>
        <div className="th">
          <h3>Carte GPS de la mission</h3>
          <div className="sub">
            {m.fromLoc} → {wp.length ? `${wp.join(' → ')} → ` : ''}{m.toLoc}
            {est.length > 0 && ` · position estimée ${Math.round((est[0].pctDone ?? 0) * 100)}%`}
          </div>
        </div>
        <div style={{ padding: 12 }}>
          <MissionMap missions={[m]} vehicles={vehicles} estimated={est} drName={drName} height={320} fitToData />
        </div>
      </div>

      <div className="tc">
        <div className="th"><h3>Frais de mission {f.confirmed ? '(confirmés)' : '(simulation)'}</h3></div>
        <table style={{ width: '100%', fontSize: '.72rem', borderCollapse: 'collapse' }}>
          <tbody>
            {f.lines.map((l, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--bl)' }}>
                <td style={{ padding: '4px 6px' }}>{l.label}</td>
                <td style={{ padding: '4px 6px', color: 'var(--tm)' }}>{l.detail}</td>
                <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 500 }}>{fk(l.montant)} DA</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr style={{ background: 'var(--a0)' }}><td colSpan={2} style={{ padding: 6, fontWeight: 700, color: 'var(--a6)' }}>TOTAL {f.confirmed ? '' : 'ESTIMÉ'}</td><td style={{ padding: 6, textAlign: 'right', fontWeight: 700, color: 'var(--a6)' }}>{fk(f.total)} DA</td></tr></tfoot>
        </table>
      </div>
    </div>
  );
}

function FraisTab({ missions, vehicles, bareme, drName, onOpen, onCloturerTerminees, pending }: {
  missions: Mission[]; vehicles: Vehicle[]; bareme?: BaremeMission; drName: (c: string | null) => string; onOpen: (m: Mission) => void;
  onCloturerTerminees: () => Promise<void>; pending: boolean;
}) {
  const [sub, setSub] = useState<'all' | 'confirmed' | 'simulated'>('all');
  if (!bareme) return null;
  const withFrais = missions.filter((m) => m.status !== 'PLANIFIEE');
  const confirmed = withFrais.filter((m) => m.fraisConfirmed);
  const simulated = withFrais.filter((m) => !m.fraisConfirmed);
  const nbTerminees = missions.filter((m) => m.status === 'TERMINEE').length;
  const totalConf = confirmed.reduce((s, m) => s + calcFraisMission(m, bareme, vehicles).total, 0);
  const totalSim = simulated.reduce((s, m) => s + calcFraisMission(m, bareme, vehicles).total, 0);

  const byCh: Record<string, Mission[]> = {};
  const visible = sub === 'confirmed' ? confirmed : sub === 'simulated' ? simulated : withFrais;
  visible.forEach((m) => { (byCh[m.driverCode ?? ''] ??= []).push(m); });

  return (
    <div className="tpane act">
      <div className="fb">
        <button className={`fc${sub === 'all' ? ' act' : ''}`} onClick={() => setSub('all')}>Tous ({withFrais.length})</button>
        <button className={`fc${sub === 'confirmed' ? ' act' : ''}`} onClick={() => setSub('confirmed')}>Confirmés ({confirmed.length})</button>
        <button className={`fc${sub === 'simulated' ? ' act' : ''}`} onClick={() => setSub('simulated')}>Simulations ({simulated.length})</button>
        <button className="btn btn-p btn-sm" disabled={pending || !nbTerminees} onClick={onCloturerTerminees}
          title="Clôture toutes les missions terminées et fige leurs frais">
          {pending ? 'Clôture…' : `Clôturer les missions terminées${nbTerminees ? ` (${nbTerminees})` : ''}`}
        </button>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: '.72rem', textAlign: 'right' }}><div style={{ color: 'var(--g6)', fontWeight: 600 }}>{fk(totalConf)} DA</div><div style={{ color: 'var(--tm)', fontSize: '.62rem' }}>confirmés</div></div>
        <div style={{ fontSize: '.72rem', textAlign: 'right' }}><div style={{ color: 'var(--a5)', fontWeight: 600 }}>{fk(totalSim)} DA</div><div style={{ color: 'var(--tm)', fontSize: '.62rem' }}>en simulation</div></div>
      </div>
      {Object.entries(byCh).sort((a, b) => drName(a[0]).localeCompare(drName(b[0]))).map(([code, ms]) => {
        const tot = ms.reduce((s, m) => s + calcFraisMission(m, bareme, vehicles).total, 0);
        return (
          <div className="tc" key={code} style={{ marginBottom: 12 }}>
            <div className="th"><h3 style={{ fontSize: '.82rem' }}>{drName(code)}</h3><div className="sub">{code} · {ms.length} mission{ms.length > 1 ? 's' : ''} · {fk(tot)} DA</div></div>
            <div style={{ padding: '0 14px 14px' }}>
              <table style={{ width: '100%', fontSize: '.72rem', borderCollapse: 'collapse' }}>
                <thead><tr style={{ background: 'var(--b0)' }}><th style={{ padding: 6, textAlign: 'left' }}>Mission</th><th style={{ padding: 6, textAlign: 'left' }}>Trajet</th><th style={{ padding: 6, textAlign: 'left' }}>Zone</th><th style={{ padding: 6, textAlign: 'left' }}>Période</th><th style={{ padding: 6, textAlign: 'right' }}>Montant</th><th style={{ padding: 6, textAlign: 'center' }}>Statut</th></tr></thead>
                <tbody>
                  {ms.map((m) => {
                    const f = calcFraisMission(m, bareme, vehicles);
                    return (
                      <tr key={m.num} style={{ borderBottom: '1px solid var(--bl)', cursor: 'pointer' }} onClick={() => onOpen(m)}>
                        <td style={{ padding: '5px 6px', fontWeight: 500 }}>{m.num}</td>
                        <td style={{ padding: '5px 6px', color: 'var(--tm)' }}>{m.fromLoc} → {m.toLoc}</td>
                        <td style={{ padding: '5px 6px' }}><span className={`bg ${m.zone === 'Sud' ? 'bg-a' : 'bg-t'}`} style={{ fontSize: '.6rem' }}>{m.zone}</span></td>
                        <td style={{ padding: '5px 6px', color: 'var(--tm)', fontSize: '.68rem' }}>{fd(m.dateStart)} → {fd(m.dateEnd)}</td>
                        <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 600, color: f.confirmed ? 'var(--g6)' : 'var(--tp)' }}>{fk(f.total)} DA</td>
                        <td style={{ padding: '5px 6px', textAlign: 'center' }}>{f.confirmed ? <span className="bg bg-g" style={{ fontSize: '.58rem' }}>CONFIRMÉ</span> : <span className="bg bg-a" style={{ fontSize: '.58rem' }}>SIMULATION</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MissionFormModal({ mission, prefill, missions, vehicles, drivers, businessUnits, bareme, qualifications, vehBlocked, drvUnavailable, serviceCarByCode, onClose, onCreate, onUpdate }: {
  mission: Mission | null;
  prefill?: Partial<Mission> | null;
  missions: Mission[]; vehicles: Vehicle[]; drivers: import('@/lib/types').Driver[]; businessUnits: BusinessUnit[]; bareme: BaremeMission;
  qualifications: { code: string; label: string }[];
  vehBlocked: (v: Vehicle) => boolean;
  drvUnavailable: (code: string | null) => boolean;
  serviceCarByCode: Map<string, { assigneeName: string; structure: string | null }>;
  onClose: () => void;
  onCreate: (b: Partial<Mission>) => Promise<void>;
  onUpdate: (num: string, b: Partial<Mission>) => Promise<void>;
}) {
  const isEdit = !!mission;
  const today = new Date().toISOString().slice(0, 10);
  const maxNum = Math.max(0, ...missions.map((m) => parseInt(m.num.split('-')[2] || '0')));
  const [f, setF] = useState<Partial<Mission>>(mission ?? prefill ?? {
    num: `M-${new Date().getFullYear()}-${String(maxNum + 1).padStart(4, '0')}`,
    dateStart: today, timeStart: '07:00', dateEnd: today, timeEnd: '17:00',
    zone: 'Locale', status: 'PLANIFIEE', distance: 0, waypoints: [], retType: 'symetrique',
  });
  const set = (k: keyof Mission) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  /**
   * Réflexe départ (retour DG) : quand on touche la date/heure de départ, tout s'actualise.
   *  - fin non fixée à la main → l'effet `schedule` la recale.
   *  - fin fixée à la main → on la décale du même écart (la durée voulue est préservée).
   */
  const setDeparture = (k: 'dateStart' | 'timeStart') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setF((s) => {
      const next = { ...s, [k]: val };
      if (endManual && s.dateStart && s.timeStart && s.dateEnd && s.timeEnd) {
        const oldDep = new Date(`${s.dateStart}T${s.timeStart}`);
        const newDep = new Date(`${next.dateStart}T${next.timeStart}`);
        const oldEnd = new Date(`${s.dateEnd}T${s.timeEnd}`);
        if (!Number.isNaN(oldDep.getTime()) && !Number.isNaN(newDep.getTime()) && !Number.isNaN(oldEnd.getTime())) {
          const shifted = new Date(oldEnd.getTime() + (newDep.getTime() - oldDep.getTime()));
          next.dateEnd = shifted.toISOString().slice(0, 10);
          next.timeEnd = shifted.toTimeString().slice(0, 5);
        }
      }
      return next;
    });
  };

  // Voitures de service : affectées en permanence à une personne. Par défaut on ne les propose pas,
  // MAIS (retour DG « des fois on emprunte quand même ») un bouton débloque l'emprunt exceptionnel
  // pour cette mission — l'affectation elle-même reste inchangée.
  const isServiceCarCode = (code: string | null | undefined) => !!code && serviceCarByCode.has(code);
  const missionStartedWithServiceCar = !!mission?.vehicleCode && serviceCarByCode.has(mission.vehicleCode);
  const [allowServiceCar, setAllowServiceCar] = useState(() => missionStartedWithServiceCar);

  // Listes filtrées : pas de véhicule en panne / réparation, ni de chauffeur indispo.
  // Les voitures de service ne sont JAMAIS dans la liste principale — elles ont leur propre
  // groupe (désactivé, ou activé après clic sur « Emprunter… »).
  const okVehicles = vehicles.filter((v) => !isServiceCarCode(v.code) && (v.code === f.vehicleCode || !vehBlocked(v)));
  const blockedVehicles = vehicles.filter((v) => v.code !== f.vehicleCode && vehBlocked(v) && !isServiceCarCode(v.code));
  const serviceCarVehicles = vehicles.filter((v) => isServiceCarCode(v.code));
  const selectedServiceCar = isServiceCarCode(f.vehicleCode) ? serviceCarByCode.get(f.vehicleCode as string) : null;
  // Un « utilisateur » (voiture de service, ne conduit pas en mission) n'est pas proposé — sauf s'il est déjà affecté.
  const okDrivers = drivers.filter((d) => d.code === f.driverCode || (!drvUnavailable(d.code) && d.personType !== 'utilisateur'));
  const blockedDrivers = drivers.filter((d) => d.code !== f.driverCode && (drvUnavailable(d.code) || d.personType === 'utilisateur'));

  const [wpInput, setWpInput] = useState('');
  const [wpRetInput, setWpRetInput] = useState('');
  const proposal = useProposal();
  const [proposals, setProposals] = useState<{ drivers: any[]; vehicles: any[] } | null>(null);

  /** Somme des tronçons d'une liste de lieux via gpsCalc. */
  const sumLegs = useCallback((legs: (string | undefined | null)[]) => {
    let total = 0;
    for (let i = 0; i < legs.length - 1; i++) total += gpsCalc(legs[i] ?? '', legs[i + 1] ?? '')?.km ?? 0;
    return Math.round(total);
  }, []);

  const retType = f.retType ?? 'symetrique';
  const wpRet = (f.waypointsRet ?? []) as string[];

  // ── Distances : purement dérivées de l'itinéraire, sauf si l'utilisateur a saisi un km à la main.
  const autoAller = useMemo(() => (f.fromLoc && f.toLoc ? sumLegs([f.fromLoc, ...(f.waypoints ?? []), f.toLoc]) : 0), [f.fromLoc, f.toLoc, f.waypoints, sumLegs]);
  const autoRetour = useMemo(() => (f.fromLoc && f.toLoc ? sumLegs([f.toLoc, ...wpRet, f.fromLoc]) : 0), [f.fromLoc, f.toLoc, wpRet, sumLegs]);
  // override init : on garde le km enregistré s'il diffère nettement du calcul (⇒ ajusté manuellement).
  const [allerOverride, setAllerOverride] = useState<number | null>(() => {
    if (!mission?.dAller) return null;
    const auto = mission.fromLoc && mission.toLoc ? sumLegs([mission.fromLoc, ...(mission.waypoints ?? []), mission.toLoc]) : 0;
    return Math.abs((mission.dAller ?? 0) - auto) > 2 ? mission.dAller : null;
  });
  const [retourOverride, setRetourOverride] = useState<number | null>(() => {
    if (!mission || mission.retType !== 'different' || !mission.dRetour) return null;
    const auto = mission.fromLoc && mission.toLoc ? sumLegs([mission.toLoc, ...((mission.waypointsRet as string[]) ?? []), mission.fromLoc]) : 0;
    return Math.abs((mission.dRetour ?? 0) - auto) > 2 ? mission.dRetour : null;
  });
  const [endManual, setEndManual] = useState(!!mission);
  const [zoneManual, setZoneManual] = useState(!!mission);

  // ── Itinéraire géolocalisé (points exacts départ / arrivée) → km routier précis via OSRM.
  //    (retour DG : « on doit utiliser des adresses si on veut être précis en km »).
  type PG = { name?: string; lat: number; lon: number } | null;
  const initGeo = (mission as { routeGeo?: { from?: PG; to?: PG } } | null)?.routeGeo ?? null;
  const [fromGeo, setFromGeo] = useState<PG>(initGeo?.from ?? null);
  const [toGeo, setToGeo] = useState<PG>(initGeo?.to ?? null);
  const [geoAller, setGeoAller] = useState<number | null>(null);
  const [geoRetour, setGeoRetour] = useState<number | null>(null);
  const [geoSource, setGeoSource] = useState<string | null>(null);
  const geoPrecise = !!(fromGeo || toGeo);

  const geoKey = JSON.stringify([fromGeo, toGeo, f.fromLoc, f.toLoc, f.waypoints ?? [], wpRet, retType]);
  useEffect(() => {
    if (!geoPrecise || !f.fromLoc || !f.toLoc) { setGeoAller(null); setGeoRetour(null); setGeoSource(null); return; }
    let cancel = false;
    const t = setTimeout(async () => {
      try {
        const a = await geoRoute([fromGeo ?? f.fromLoc!, ...(f.waypoints ?? []), toGeo ?? f.toLoc!]);
        if (cancel) return;
        setGeoAller(a.km > 0 ? a.km : null);
        setGeoSource(a.source);
        if (retType === 'different') {
          const r = await geoRoute([toGeo ?? f.toLoc!, ...wpRet, fromGeo ?? f.fromLoc!]);
          if (!cancel) setGeoRetour(r.km > 0 ? r.km : null);
        } else setGeoRetour(null);
      } catch { if (!cancel) { setGeoAller(null); setGeoSource(null); } }
    }, 300);
    return () => { cancel = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoKey]);

  const dAller = allerOverride ?? geoAller ?? autoAller;
  const dRetour = retType === 'aucun' ? 0 : retType === 'symetrique' ? dAller : (retourOverride ?? geoRetour ?? autoRetour);
  const totalDist = dAller + dRetour;
  const allerManual = allerOverride != null;
  const retourManual = retourOverride != null;
  /** À appeler dès qu'on modifie l'itinéraire : le système réactualise distances / horaires / zone. */
  const routeChanged = () => { setAllerOverride(null); setRetourOverride(null); setEndManual(false); setZoneManual(false); };

  // ── Regroupement de plusieurs demandes de prise en charge dans cette mission (retour DG) ──
  const dpcRefs = (f.dpcRefs ?? []) as string[];
  const groupable = useGroupableDpc({ fromLoc: f.fromLoc ?? undefined, toLoc: f.toLoc ?? undefined, dateStart: f.dateStart ?? undefined, excludeCodes: dpcRefs });
  const groupPreview = useMissionGroupPreview();
  const groupSplit = (f.costSplit ?? null) as Mission['costSplit'];

  /** Coche/décoche une demande → recalcule le trajet (étapes aller + retour), les personnes et la répartition. */
  const applyGroup = async (codes: string[]) => {
    setF((s) => ({ ...s, dpcRefs: codes }));
    if (codes.length === 0) { setF((s) => ({ ...s, costSplit: null, pax: null })); return; }
    try {
      const r = await groupPreview.mutateAsync({ dpcCodes: codes, fromLoc: f.fromLoc ?? undefined, toLoc: f.toLoc ?? undefined });
      if (r.ok) {
        setF((s) => {
          const next: Partial<Mission> = {
            ...s, dpcRefs: codes, fromLoc: r.fromLoc, toLoc: r.toLoc,
            waypoints: r.waypoints, waypointsRet: r.waypointsRet, retType: r.retType,
            bu: r.bu ?? s.bu, costSplit: codes.length >= 2 ? r.costSplit : null,
            pax: r.pax || s.pax, tonnage: r.tonnage || s.tonnage,
          };
          // Si aucun véhicule choisi (ou trop petit) et un seul assez grand est libre → on le propose.
          const cur = vehicles.find((v) => v.code === s.vehicleCode);
          const needP = r.pax || 0;
          const needT = r.tonnage || 0;
          const curTooSmall = cur && ((cur.seats != null && needP > 0 && needP > cur.seats) || (cur.maxTonnage != null && needT > 0 && needT > cur.maxTonnage + 0.001));
          if ((needP > 0 || needT > 0) && (!s.vehicleCode || curTooSmall)) {
            const fit = (r.fitVehicles ?? []).filter((c) => { const v = vehicles.find((x) => x.code === c); return v && !vehBlocked(v) && !isServiceCarCode(c); });
            if (fit.length === 1) {
              next.vehicleCode = fit[0];
              const dc = vehicles.find((x) => x.code === fit[0])?.driverCode;
              if (dc && !s.driverCode && !drvUnavailable(dc)) next.driverCode = dc;
            } else if (curTooSmall) {
              next.vehicleCode = '';
            }
          }
          return next;
        });
        setAllerOverride(null); setRetourOverride(null); setEndManual(false); setZoneManual(false);
      }
    } catch { toast.error('Impossible de calculer le regroupement'); }
  };

  // ── Contrôle de capacité : assez de places pour les personnes ET assez de charge utile.
  const pax = Number(f.pax ?? 0);
  const tonReq = Number(f.tonnage ?? 0);
  const selVeh = vehicles.find((v) => v.code === f.vehicleCode);
  const vehTooSmall = (v: Vehicle) =>
    (v.seats != null && pax > 0 && pax > v.seats) ||
    (v.maxTonnage != null && tonReq > 0 && tonReq > v.maxTonnage + 0.001);
  const capIssueSeats = !!selVeh && selVeh.seats != null && pax > 0 && pax > selVeh.seats;
  const capIssueTon = !!selVeh && selVeh.maxTonnage != null && tonReq > 0 && tonReq > selVeh.maxTonnage + 0.001;
  const capacityIssue = capIssueSeats || capIssueTon;
  const capNeedLabel = [pax > 0 ? `${pax} pax` : '', tonReq > 0 ? `${tonReq} t` : ''].filter(Boolean).join(' · ');

  const runProposal = async () => {
    const v = vehicles.find((x) => x.code === f.vehicleCode);
    const res = await proposal.mutateAsync({
      vehicleType: v?.type,
      requiredQual: f.requiredQual || undefined,
      qualityCriteria: f.qualityCriteria || undefined,
      durationDays: f.dateStart && f.dateEnd ? Math.max(1, Math.round((+new Date(f.dateEnd) - +new Date(f.dateStart)) / 86_400_000) + 1) : 1,
    });
    setProposals(res);
  };

  const addWp = () => {
    if (!wpInput.trim()) return;
    setF((s) => ({ ...s, waypoints: [...(s.waypoints ?? []), wpInput.trim()] }));
    setWpInput('');
    routeChanged();
  };
  const removeWp = (i: number) => {
    setF((s) => ({ ...s, waypoints: (s.waypoints ?? []).filter((_, j) => j !== i) }));
    routeChanged();
  };
  const addWpRet = () => {
    if (!wpRetInput.trim()) return;
    setF((s) => ({ ...s, waypointsRet: [...((s.waypointsRet as string[]) ?? []), wpRetInput.trim()] }));
    setWpRetInput('');
    routeChanged();
  };
  const removeWpRet = (i: number) => {
    setF((s) => ({ ...s, waypointsRet: ((s.waypointsRet as string[]) ?? []).filter((_, j) => j !== i) }));
    routeChanged();
  };
  const setRetType = (v: string) => {
    setF((s) => {
      const ns: Partial<Mission> = { ...s, retType: v };
      if (v === 'symetrique') ns.waypointsRet = [...(s.waypoints ?? [])].reverse();
      if (v === 'aucun') ns.waypointsRet = [];
      return ns;
    });
    setRetourOverride(null);
    setEndManual(false);
  };

  const SPEED = 65; // km/h moyen route
  const REST_H = 1; // pause sur place avant retour
  /** Horaires théoriques (contrôle anti-fraude) — recalculés dès qu'une donnée change. */
  const schedule = useMemo(() => {
    if (!f.dateStart || !f.timeStart || totalDist <= 0) return null;
    const dep = new Date(`${f.dateStart}T${f.timeStart}`);
    if (Number.isNaN(dep.getTime())) return null;
    const allerH = dAller / SPEED;
    const arr = new Date(dep.getTime() + allerH * 3_600_000);
    const retArr = new Date(arr.getTime() + (REST_H + dRetour / SPEED) * 3_600_000);
    const fmtD = (d: Date) => d.toISOString().slice(0, 10);
    const fmtT = (d: Date) => d.toTimeString().slice(0, 5);
    const end = retType === 'aucun' ? arr : retArr;
    return {
      arrDate: fmtD(arr), arrTime: fmtT(arr),
      endDate: fmtD(end), endTime: fmtT(end),
      totalH: Math.round((allerH + (retType === 'aucun' ? 0 : REST_H + dRetour / SPEED)) * 10) / 10,
    };
  }, [f.dateStart, f.timeStart, dAller, dRetour, totalDist, retType]);

  // Réflexe : tant que l'utilisateur n'a pas fixé la fin à la main, elle suit la proposition.
  useEffect(() => {
    if (endManual || !schedule) return;
    if (f.dateEnd === schedule.endDate && f.timeEnd === schedule.endTime) return;
    setF((s) => ({ ...s, dateEnd: schedule.endDate, timeEnd: schedule.endTime }));
  }, [schedule, endManual, f.dateEnd, f.timeEnd]);

  // Réflexe : la zone barème se déduit de la destination (Sud) et de la distance — override libre.
  const guessedZone = useMemo(() => {
    const to = (f.toLoc ?? '').toLowerCase();
    if (/ghard|ouargla|béchar|bechar|adrar|tamanrasset|illizi|tindouf|laghouat|el oued|el-oued|hassi|in salah|djanet|timimoun|el bayadh/.test(to)) return 'Sud';
    if (totalDist >= 400) return 'Nationale';
    if (totalDist >= 120) return 'Régionale';
    return 'Locale';
  }, [f.toLoc, totalDist]);
  useEffect(() => {
    if (zoneManual || !f.toLoc || totalDist <= 0) return;
    if (f.zone !== guessedZone) setF((s) => ({ ...s, zone: guessedZone }));
  }, [guessedZone, zoneManual, f.toLoc, totalDist, f.zone]);

  const applySchedule = () => {
    if (!schedule) return;
    setEndManual(false);
    setF((s) => ({ ...s, dateEnd: schedule.endDate, timeEnd: schedule.endTime }));
  };

  const preview = calcFraisMission({ ...f, distance: totalDist }, bareme, vehicles);
  const buCa = businessUnits.find((b) => b.code === f.bu)?.ca ?? [];
  const siteOptions = withCurrentSite(useSiteNames(), f.site);

  // Aperçu carte GPS de l'itinéraire — se met à jour dès qu'on saisit / ajoute un lieu.
  const routeKey = JSON.stringify({ from: f.fromLoc, to: f.toLoc, wp: f.waypoints ?? [], rt: retType, wpr: wpRet, v: f.vehicleCode, d: f.driverCode, da: dAller, dr: dRetour });
  const deferredRoute = useDeferredValue(routeKey);
  const previewMission = useMemo<Mission[]>(() => {
    const s = JSON.parse(deferredRoute) as { from?: string; to?: string; wp: string[]; rt: string; wpr: string[]; v?: string; d?: string; da: number; dr: number };
    if (!s.from || !s.to) return [];
    const out: Mission[] = [{
      num: 'preview-aller', fromLoc: s.from, toLoc: s.to, waypoints: s.wp,
      status: 'PLANIFIEE', distance: s.da, vehicleCode: s.v ?? null, driverCode: s.d ?? null,
    } as Mission];
    if (s.rt === 'different') {
      out.push({
        num: 'preview-retour', fromLoc: s.to, toLoc: s.from, waypoints: s.wpr,
        status: 'EN_COURS', distance: s.dr, vehicleCode: s.v ?? null, driverCode: s.d ?? null,
      } as Mission);
    }
    return out;
  }, [deferredRoute]);

  const submit = async () => {
    const miss = [
      !f.fromLoc?.trim() && 'lieu de départ',
      !f.toLoc?.trim() && 'lieu d’arrivée',
      !f.dateStart && 'date de départ',
      !f.vehicleCode && 'véhicule',
      !f.driverCode && 'chauffeur',
    ].filter(Boolean);
    if (miss.length) { toast.error(`Champs obligatoires : ${miss.join(', ')}`); return; }
    if (totalDist <= 0) { toast.error('Distance nulle — vérifie les lieux (départ ≠ arrivée, noms reconnus)'); return; }
    if (capacityIssue) {
      const parts = [capIssueSeats && `${selVeh!.seats} place(s) < ${pax} pers.`, capIssueTon && `${selVeh!.maxTonnage} t de charge utile < ${tonReq} t`].filter(Boolean).join(' · ');
      toast.error(`${selVeh!.code} : ${parts}. Choisir un véhicule plus grand.`); return;
    }
    // Itinéraire géolocalisé : si le calcul OSRM n'a pas encore répondu (ou l'utilisateur
    // enregistre vite), on le fait maintenant pour ne pas figer un km moins précis.
    let dA = dAller, dR = dRetour;
    if ((fromGeo || toGeo) && !allerManual && geoAller == null && f.fromLoc && f.toLoc) {
      try {
        const a = await geoRoute([fromGeo ?? f.fromLoc, ...(f.waypoints ?? []), toGeo ?? f.toLoc]);
        if (a.km > 0) {
          dA = a.km;
          dR = retType === 'aucun' ? 0 : retType === 'symetrique' ? a.km
            : (retourManual ? dRetour : ((await geoRoute([toGeo ?? f.toLoc, ...wpRet, fromGeo ?? f.fromLoc])).km || a.km));
        }
      } catch { /* on garde l'estimation par noms */ }
    }
    const body: Partial<Mission> = {
      ...f, retType, dAller: dA, dRetour: dR, distance: dA + dR,
      pax: pax > 0 ? pax : null,
      tonnage: tonReq > 0 ? tonReq : null,
      waypointsRet: retType === 'symetrique' ? [...(f.waypoints ?? [])].reverse() : retType === 'aucun' ? [] : wpRet,
      dpcRefs: dpcRefs.length ? dpcRefs : undefined,
      routeGeo: (fromGeo || toGeo)
        ? { from: fromGeo, to: toGeo, source: geoSource ?? undefined }
        : null,
    } as Partial<Mission>;
    if (isEdit) await onUpdate(mission!.num, body);
    else await onCreate(body);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={`${isEdit ? 'Modifier' : 'Nouvelle'} Mission`} wide expandable
      footer={<><button className="btn btn-o" onClick={onClose}>Annuler</button><button className="btn btn-p" onClick={submit}>Enregistrer</button></>}>
      {mission?.status === 'TERMINEE' && (
        <div style={{ marginBottom: 10, padding: '6px 10px', borderRadius: 'var(--rs)', background: 'var(--a0, #fff7ed)', border: '1px solid var(--a2, #fed7aa)', fontSize: '.74rem', color: 'var(--a6)', fontWeight: 600 }}>
          Mission terminée — corrections avant clôture uniquement. Une fois clôturée, elle est verrouillée.
        </div>
      )}
      {mission?.status === 'EN_COURS' && (
        <div style={{ marginBottom: 10, padding: '6px 10px', borderRadius: 'var(--rs)', background: 'var(--g0, #f0fdf4)', border: '1px solid var(--g2, #bbf7d0)', fontSize: '.74rem', color: 'var(--g6)', fontWeight: 600 }}>
          Mission démarrée — vous pouvez encore ajouter / modifier (étapes, véhicule, chauffeur…).
        </div>
      )}
      {(!mission || mission.status === 'PLANIFIEE') && (
        <div style={{ marginBottom: 10, fontSize: '.72rem', color: 'var(--tm)' }}>
          L&apos;ordre de mission sera <b>émis au démarrage</b> et transmis automatiquement au chauffeur sur son application.
          {isEdit && mission?.officeValidated === true && ' Le demandeur a été informé à la validation.'}
        </div>
      )}
      <div className="form-r">
        <div className="form-g"><label>Date Départ *</label><DateInput value={f.dateStart ?? ''} onChange={setDeparture('dateStart')} /></div>
        <div className="form-g"><label>Heure Départ</label><input type="time" value={f.timeStart ?? ''} onChange={setDeparture('timeStart')} /></div>
      </div>
      <div className="form-r">
        <div className="form-g"><label>Date Fin {!endManual && <span style={{ color: 'var(--tm)', fontWeight: 400 }}>— auto</span>}</label><DateInput value={f.dateEnd ?? ''} onChange={(e) => { setEndManual(true); set('dateEnd')(e); }} /></div>
        <div className="form-g"><label>Heure Fin {!endManual && <span style={{ color: 'var(--tm)', fontWeight: 400 }}>— auto</span>}</label><input type="time" value={f.timeEnd ?? ''} onChange={(e) => { setEndManual(true); set('timeEnd')(e); }} /></div>
      </div>
      <div className="form-r">
        <div className="form-g"><label>Lieu Départ *</label>
          <PlaceInput value={f.fromLoc ?? ''} geo={fromGeo}
            onChange={(v, g) => { setF((s) => ({ ...s, fromLoc: v })); setFromGeo(g); routeChanged(); }}
            placeholder="Ville, commune ou adresse précise…" />
        </div>
        <div className="form-g"><label>Lieu Arrivée *</label>
          <PlaceInput value={f.toLoc ?? ''} geo={toGeo}
            onChange={(v, g) => { setF((s) => ({ ...s, toLoc: v })); setToGeo(g); routeChanged(); }}
            placeholder="Ville, commune ou adresse précise…" />
        </div>
      </div>
      {(dpcRefs.length > 0 || (groupable.data ?? []).length > 0) && (
        <div className="route-section" style={{ margin: '4px 0 10px', borderColor: 'var(--b5)' }}>
          <div style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--b6)', marginBottom: 6 }}>
            Demandes de prise en charge groupées {dpcRefs.length > 1 ? `(${dpcRefs.length})` : ''}
            {groupPreview.isPending && <span style={{ fontWeight: 400, color: 'var(--tm)' }}> · calcul…</span>}
          </div>
          <div style={{ fontSize: '.68rem', color: 'var(--tm)', marginBottom: 6 }}>
            Coche les demandes sur le même axe : leurs points de dépose/reprise deviennent des étapes (aller + retour), et les frais/cession se répartissent par BU/structure.
          </div>
          {dpcRefs.map((code, i) => (
            <label key={code} className="wp-item" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: dpcRefs.length > 1 ? 'pointer' : 'default' }}>
              <input type="checkbox" checked readOnly onClick={() => dpcRefs.length > 1 && applyGroup(dpcRefs.filter((c) => c !== code))} />
              <span className="wp-line"><b>{code}</b> <span style={{ color: 'var(--tm)' }}>{i === 0 ? 'demande d’origine' : 'ajoutée'}{dpcRefs.length > 1 ? ' — décocher pour retirer' : ''}</span></span>
            </label>
          ))}
          {(groupable.data ?? []).map((d: any) => (
            <label key={d.code} className="wp-item" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={false} onChange={() => applyGroup([...dpcRefs, d.code])} />
              <span className="wp-line" style={{ fontSize: '.72rem' }}>
                <b>{d.code}</b> · {d.depAller} → {d.destAller} · {d.pax ?? 1} pax · {d.bu ?? '—'}
                {d.dateAller ? ` · ${fd(d.dateAller)}` : ''}
                <span style={{ color: d.detourKm > 0 ? 'var(--a6)' : 'var(--g6)' }}> · +{d.detourKm} km détour</span>
              </span>
            </label>
          ))}
          {(groupSplit ?? []).length > 1 && (
            <div className="tw" style={{ marginTop: 8 }}>
              <table>
                <thead><tr><th>Demande</th><th>BU / Structure</th><th>Pax</th><th>Km à bord</th><th>Part frais + cession</th></tr></thead>
                <tbody>
                  {(groupSplit ?? []).map((s) => (
                    <tr key={s.dpcCode}>
                      <td style={{ fontWeight: 600 }}>{s.dpcCode}</td>
                      <td style={{ fontSize: '.72rem' }}>{s.bu ?? '—'}<div style={{ fontSize: '.62rem', color: 'var(--tm)' }}>{s.structure}</div></td>
                      <td>{s.pax}</td>
                      <td>{fk(s.segmentKm)} km{s.roundTrip ? ' ×2' : ''}</td>
                      <td style={{ fontWeight: 700, color: 'var(--b6)' }}>{s.sharePct} %</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      <div className="route-section" style={{ margin: '4px 0 10px' }}>
        <div style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--tp)', marginBottom: 6 }}>▶ Points intermédiaires ALLER (multipoint)</div>
        {(f.waypoints ?? []).map((w, i) => (
          <div className="wp-item" key={i}><span className="wp-num">{i + 1}</span><span className="wp-line">{w}</span><button type="button" className="wp-remove" onClick={() => removeWp(i)}>✕</button></div>
        ))}
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <div style={{ flex: 1 }}>
            <PlaceInput value={wpInput} onChange={(v) => setWpInput(v)} placeholder="Étape : commune, rue ou adresse précise…" />
          </div>
          <button type="button" className="btn btn-mp btn-sm" onClick={addWp}>+ Ajouter</button>
        </div>
      </div>

      {retType === 'different' && (
        <div className="route-section" style={{ margin: '4px 0 10px', borderColor: 'var(--a5)' }}>
          <div style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--a6)', marginBottom: 6 }}>◀ Points intermédiaires RETOUR ({f.toLoc || 'arrivée'} → {f.fromLoc || 'départ'})</div>
          {wpRet.map((w, i) => (
            <div className="wp-item" key={i}><span className="wp-num">{i + 1}</span><span className="wp-line">{w}</span><button type="button" className="wp-remove" onClick={() => removeWpRet(i)}>✕</button></div>
          ))}
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <div style={{ flex: 1 }}>
              <PlaceInput value={wpRetInput} onChange={(v) => setWpRetInput(v)} placeholder="Étape du trajet retour : commune, rue, adresse…" />
            </div>
            <button type="button" className="btn btn-mp btn-sm" onClick={addWpRet}>+ Ajouter</button>
          </div>
        </div>
      )}

      <div className="tc" style={{ marginBottom: 12 }}>
        <div className="th">
          <h3 style={{ fontSize: '.78rem' }}>Carte GPS de l&apos;itinéraire</h3>
          <div className="sub" style={{ fontSize: '.7rem' }}>
            {previewMission.length
              ? `${f.fromLoc}${(f.waypoints ?? []).length ? ' → ' + (f.waypoints ?? []).join(' → ') : ''} → ${f.toLoc} · ${dAller} km aller${retType === 'aucun' ? ' (aller simple)' : ` · ${dRetour} km retour · ${totalDist} km aller-retour`}`
              : 'Saisir un lieu de départ et une arrivée pour afficher le tracé.'}
          </div>
        </div>
        <div style={{ padding: 10 }}>
          {previewMission.length ? (
            <MissionMap missions={previewMission} vehicles={vehicles} height={300} fitToData />
          ) : (
            <div style={{ height: 160, display: 'grid', placeItems: 'center', color: 'var(--tm)', fontSize: '.75rem', border: '1px dashed var(--bd)', borderRadius: 8 }}>
              La carte s&apos;affiche dès que le départ et l&apos;arrivée sont renseignés.
            </div>
          )}
        </div>
      </div>

      <div className="form-r">
        <div className="form-g"><label>Distance Aller (km) {
          allerManual ? <span style={{ color: 'var(--a6)', fontWeight: 400 }}>— saisi</span>
            : geoAller != null ? <span style={{ color: 'var(--g6)', fontWeight: 400 }}>— {geoSource === 'osrm' ? 'routier précis (OSRM)' : 'estimé (points exacts)'} </span>
              : <span style={{ color: 'var(--tm)', fontWeight: 400 }}>— auto villes ({autoAller} km)</span>
        }</label>
          <div style={{ display: 'flex', gap: 4 }}>
            <input type="number" value={dAller} onChange={(e) => setAllerOverride(Number(e.target.value))} style={{ flex: 1 }} />
            <button type="button" className="btn btn-o btn-sm" title="Reprendre le calcul d'après l'itinéraire" onClick={() => setAllerOverride(null)} disabled={!allerManual}>↻</button>
          </div>
          {geoPrecise && geoAller == null && (
            <div style={{ fontSize: '.64rem', color: 'var(--tm)', marginTop: 2 }}>calcul du km précis…</div>
          )}
        </div>
        <div className="form-g"><label>Type de retour</label>
          <select value={retType} onChange={(e) => setRetType(e.target.value)}>
            <option value="symetrique">Retour = aller</option>
            <option value="different">Retour différent (avec étapes)</option>
            <option value="aucun">Aller simple (pas de retour)</option>
          </select>
        </div>
      </div>
      <div className="form-r">
        <div className="form-g"><label>Distance Retour (km) {retType === 'different' && (!retourManual ? <span style={{ color: 'var(--tm)', fontWeight: 400 }}>— auto ({autoRetour} km)</span> : <span style={{ color: 'var(--a6)', fontWeight: 400 }}>— saisi</span>)}</label>
          <div style={{ display: 'flex', gap: 4 }}>
            <input type="number" value={dRetour} readOnly={retType !== 'different'}
              onChange={(e) => setRetourOverride(Number(e.target.value))} style={{ flex: 1 }} />
            {retType === 'different' && <button type="button" className="btn btn-o btn-sm" title="Reprendre le calcul d'après le trajet retour" onClick={() => setRetourOverride(null)} disabled={!retourManual}>↻</button>}
          </div>
        </div>
        <div className="form-g"><label>Distance Totale (aller + retour)</label><input value={`${totalDist} km`} readOnly style={{ fontWeight: 700 }} /></div>
      </div>

      {schedule && (
        <div style={{ margin: '2px 0 12px', padding: '8px 12px', borderRadius: 'var(--rs)', background: 'var(--g1)', border: '1px solid var(--g5)', fontSize: '.75rem' }}>
          <div style={{ fontWeight: 600, color: 'var(--g6)', marginBottom: 4 }}>
            Horaires théoriques (contrôle anti-fraude) — {totalDist} km à ~{SPEED} km/h + {REST_H} h sur place
            {!endManual && <span style={{ fontWeight: 400 }}> · appliqués automatiquement aux dates de fin</span>}
          </div>
          <div style={{ color: 'var(--tp)' }}>
            Arrivée estimée : <b>{schedule.arrDate} {schedule.arrTime}</b>
            {retType !== 'aucun' && <> · Retour estimé : <b>{schedule.endDate} {schedule.endTime}</b></>}
            {' · '}durée ~{schedule.totalH} h
          </div>
          {endManual && <button type="button" className="btn btn-o btn-sm" style={{ marginTop: 4 }} onClick={applySchedule}>Réappliquer aux dates / heures de fin</button>}
        </div>
      )}
      <div className="form-r">
        <div className="form-g"><label>Zone (barème NORD/SUD) {!zoneManual && <span style={{ color: 'var(--tm)', fontWeight: 400 }}>— auto</span>}</label><select value={f.zone ?? 'Locale'} onChange={(e) => { setZoneManual(true); set('zone')(e); }}>{['Locale', 'Régionale', 'Nationale', 'Sud'].map((z) => <option key={z}>{z}</option>)}</select></div>
        <div className="form-g"><label>Qualification requise</label>
          <select value={f.requiredQual ?? ''} onChange={set('requiredQual')}>
            <option value="">— Aucune —</option>
            {qualifications.map((q) => <option key={q.code} value={q.code}>{q.label}</option>)}
          </select>
        </div>
      </div>
      <div className="form-r">
        <div className="form-g"><label>Critère qualité (véhicule / chauffeur)</label>
          <select value={f.qualityCriteria ?? ''} onChange={set('qualityCriteria')}>
            <option value="">— Aucun —</option>
            <option>Délégation officielle</option>
            <option>Produits sensibles</option>
            <option>Transport de personnalités</option>
            <option>Matières dangereuses</option>
          </select>
        </div>
        <div className="form-g"><label>Frais de mission</label>
          <select value={f.fraisApplicable === null || f.fraisApplicable === undefined ? 'auto' : f.fraisApplicable ? 'oui' : 'non'}
            onChange={(e) => setF((s) => ({ ...s, fraisApplicable: e.target.value === 'auto' ? null : e.target.value === 'oui' }))}>
            <option value="auto">Auto (selon distance / lieu de travail)</option>
            <option value="oui">Concernée par frais</option>
            <option value="non">Non concernée</option>
          </select>
        </div>
      </div>
      <div className="form-r">
        <div className="form-g">
          <label>Chauffeur <span style={{ color: 'var(--r6)' }}>*</span> <span style={{ color: 'var(--tm)', fontWeight: 400 }}>(les indisponibles sont exclus)</span></label>
          <div style={{ display: 'flex', gap: 6 }}>
            <select value={f.driverCode ?? ''} onChange={(e) => {
              const code = e.target.value;
              setF((s) => {
                const ns = { ...s, driverCode: code };
                // Réflexe : chauffeur avec véhicule attitré + véhicule pas encore choisi → on le propose.
                const dv = drivers.find((x) => x.code === code)?.vehicleCode;
                if (dv && !s.vehicleCode && !isServiceCarCode(dv) && !vehBlocked(vehicles.find((v) => v.code === dv) ?? ({} as Vehicle))) ns.vehicleCode = dv;
                return ns;
              });
            }} style={{ flex: 1, ...(!f.driverCode ? { borderColor: 'var(--r6)' } : {}) }}>
              <option value="">— choisir —</option>
              {okDrivers.map((d) => <option key={d.code} value={d.code}>{d.name}{d.status && d.status !== 'DISPONIBLE' ? ` (${d.status})` : ''}</option>)}
              {blockedDrivers.length > 0 && (
                <optgroup label="Indisponibles (repos / congé / indispo)">
                  {blockedDrivers.map((d) => <option key={d.code} value={d.code} disabled>{d.name} — {d.status}</option>)}
                </optgroup>
              )}
            </select>
            <button type="button" className="btn btn-o btn-sm" onClick={runProposal} disabled={proposal.isPending}>Proposer</button>
          </div>
        </div>
        <div className="form-g"><label>Véhicule <span style={{ color: 'var(--r6)' }}>*</span> <span style={{ color: 'var(--tm)', fontWeight: 400 }}>(pannes / réparations exclues{capNeedLabel ? ` · ≥ ${capNeedLabel}` : ''})</span></label>
          <select value={f.vehicleCode ?? ''} style={(!f.vehicleCode || capacityIssue) ? { borderColor: 'var(--r6)' } : undefined} onChange={(e) => {
            const code = e.target.value;
            setF((s) => {
              const ns = { ...s, vehicleCode: code };
              // Réflexe : véhicule avec chauffeur attitré + chauffeur pas encore choisi → on le propose.
              const dc = vehicles.find((x) => x.code === code)?.driverCode;
              if (dc && !s.driverCode && !drvUnavailable(dc)) ns.driverCode = dc;
              return ns;
            });
          }}>
            <option value="">— choisir —</option>
            {okVehicles.filter((v) => !vehTooSmall(v)).map((v) => <option key={v.code} value={v.code}>{v.code} — {v.brand} {v.model}{v.seats != null ? ` · ${v.seats} pax` : ''}{v.maxTonnage != null ? ` · ${v.maxTonnage} t` : ''}</option>)}
            {allowServiceCar && serviceCarVehicles.length > 0 && (
              <optgroup label="Voitures de service — emprunt exceptionnel">
                {serviceCarVehicles.map((v) => <option key={v.code} value={v.code}>{v.code} — {v.brand} {v.model} — {serviceCarByCode.get(v.code)?.assigneeName}</option>)}
              </optgroup>
            )}
            {(pax > 0 || tonReq > 0) && okVehicles.some((v) => vehTooSmall(v)) && (
              <optgroup label={`Trop petits pour ${capNeedLabel}`}>
                {okVehicles.filter((v) => vehTooSmall(v)).map((v) => <option key={v.code} value={v.code}>{v.code} — {v.brand} {v.model}{v.seats != null ? ` · ${v.seats} pax` : ''}{v.maxTonnage != null ? ` · ${v.maxTonnage} t` : ''}</option>)}
              </optgroup>
            )}
            {blockedVehicles.length > 0 && (
              <optgroup label="Indisponibles (panne / hors service / réparation)">
                {blockedVehicles.map((v) => <option key={v.code} value={v.code} disabled>{v.code} — {v.brand} {v.model} ({v.status})</option>)}
              </optgroup>
            )}
            {!allowServiceCar && serviceCarVehicles.length > 0 && (
              <optgroup label="Voitures de service (affectées à une personne — voir bouton ci-dessous)">
                {serviceCarVehicles.map((v) => <option key={v.code} value={v.code} disabled>{v.code} — {v.brand} {v.model} — {serviceCarByCode.get(v.code)?.assigneeName}</option>)}
              </optgroup>
            )}
          </select>
          {serviceCarVehicles.length > 0 && !allowServiceCar && (
            <button type="button" onClick={() => setAllowServiceCar(true)}
              style={{ marginTop: 6, background: 'var(--b0)', border: '1px solid var(--b2)', borderRadius: 'var(--rs)', padding: '4px 8px', color: 'var(--b6)', fontSize: '.72rem', fontWeight: 600, cursor: 'pointer' }}>
              Emprunter une voiture de service pour cette mission
            </button>
          )}
          {allowServiceCar && (
            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3, background: 'var(--a0, var(--b0))', border: '1px solid var(--a2, var(--b2))', borderRadius: 'var(--rs)', padding: '5px 8px' }}>
              {selectedServiceCar ? (
                <div style={{ fontSize: '.72rem', color: 'var(--a6)', fontWeight: 600 }}>
                  {f.vehicleCode} est la voiture de service de {selectedServiceCar.assigneeName}
                  {selectedServiceCar.structure ? ` (${selectedServiceCar.structure})` : ''} — emprunt exceptionnel, l&apos;affectation reste inchangée.
                </div>
              ) : (
                <div style={{ fontSize: '.72rem', color: 'var(--b6)', fontWeight: 600 }}>
                  ✓ Emprunt débloqué — choisissez la voiture dans le groupe « Voitures de service — emprunt exceptionnel » de la liste.
                </div>
              )}
              {!missionStartedWithServiceCar && (
                <button type="button" onClick={() => { setAllowServiceCar(false); if (isServiceCarCode(f.vehicleCode)) setF((s) => ({ ...s, vehicleCode: '' })); }}
                  style={{ background: 'none', border: 0, padding: 0, color: 'var(--tm)', fontSize: '.68rem', cursor: 'pointer', textDecoration: 'underline', alignSelf: 'flex-start' }}>
                  ↩ Annuler l&apos;emprunt
                </button>
              )}
            </div>
          )}
          {capacityIssue && (
            <div style={{ fontSize: '.7rem', color: 'var(--r6)', marginTop: 4, fontWeight: 600 }}>
              {selVeh!.code} : {capIssueSeats ? `${selVeh!.seats} place(s) — insuffisant pour ${pax} personne(s)` : ''}
              {capIssueSeats && capIssueTon ? ' · ' : ''}
              {capIssueTon ? `charge utile ${selVeh!.maxTonnage} t — insuffisant pour ${tonReq} t` : ''}. Choisir un véhicule plus grand.
            </div>
          )}
        </div>
      </div>
      <div className="form-r">
        <div className="form-g">
          <label>Personnes à transporter {dpcRefs.length >= 2 && <span style={{ color: 'var(--tm)', fontWeight: 400 }}>(auto)</span>}</label>
          <input type="number" min={0} value={f.pax ?? ''} placeholder="0"
            onChange={(e) => setF((s) => ({ ...s, pax: e.target.value === '' ? null : Number(e.target.value) }))} />
        </div>
        <div className="form-g">
          <label>Tonnage requis (t) {dpcRefs.length >= 2 && <span style={{ color: 'var(--tm)', fontWeight: 400 }}>(auto)</span>}</label>
          <input type="number" step="0.1" min={0} value={f.tonnage ?? ''} placeholder="0"
            onChange={(e) => setF((s) => ({ ...s, tonnage: e.target.value === '' ? null : Number(e.target.value) }))} />
        </div>
      </div>

      {proposals && (
        <div className="cr" style={{ marginBottom: 10 }}>
          <div className="cc" style={{ padding: 10 }}>
            <div style={{ fontSize: '.72rem', fontWeight: 600, marginBottom: 6 }}>Chauffeurs recommandés</div>
            {proposals.drivers.slice(0, 5).map((d, i) => (
              <div key={d.code} className="sel-row" style={{ cursor: 'pointer' }} onClick={() => setF((s) => ({ ...s, driverCode: d.code }))}>
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 600 }}>{i + 1}. {d.name}</span>
                  <div style={{ fontSize: '.66rem', color: 'var(--tm)' }}>{d.license} · fat {Math.round((d.fatigue ?? 0) * 100)}% · {d.hoursWeek}h + {d.missionHours}h mission {d.reasons?.length ? `· ${d.reasons.join(', ')}` : ''}</div>
                </div>
                <span className={`sel-score ${d.score >= 70 ? 'score-hi' : d.score >= 40 ? 'score-md' : 'score-lo'}`}>{d.score}</span>
              </div>
            ))}
          </div>
          <div className="cc" style={{ padding: 10 }}>
            <div style={{ fontSize: '.72rem', fontWeight: 600, marginBottom: 6 }}>Véhicules recommandés</div>
            {proposals.vehicles.slice(0, 5).map((v, i) => (
              <div key={v.code} className="sel-row" style={{ cursor: 'pointer' }} onClick={() => setF((s) => ({ ...s, vehicleCode: v.code }))}>
                <div style={{ minWidth: 0 }}><span style={{ fontWeight: 600 }}>{i + 1}. {v.code} — {v.label}</span>
                  <div style={{ fontSize: '.66rem', color: 'var(--tm)' }}>{fk(v.km)} km {v.reasons?.length ? `· ${v.reasons.join(', ')}` : ''}</div></div>
                <span className={`sel-score ${v.score >= 70 ? 'score-hi' : v.score >= 40 ? 'score-md' : 'score-lo'}`}>{v.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="form-r">
        <div className="form-g"><label>Business Unit <span style={{ color: 'var(--r6)' }}>*</span></label><select value={f.bu ?? ''} onChange={set('bu')}><option value="">—</option>{businessUnits.map((b) => <option key={b.code} value={b.code}>{b.code} — {b.name}</option>)}</select></div>
        <div className="form-g"><label>Centre Analytique <span style={{ color: 'var(--r6)' }}>*</span></label><select value={f.ca ?? ''} onChange={set('ca')}><option value="">—</option>{buCa.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.nom}</option>)}</select></div>
      </div>
      {(!f.bu || !f.ca) && (
        <div style={{ fontSize: '.72rem', color: 'var(--a6)', background: 'var(--a0)', border: '1px solid var(--a3)', borderRadius: 'var(--rs)', padding: '6px 10px', marginTop: -4 }}>
          BU + centre de coût <b>obligatoires</b> pour valider et démarrer la mission (rattachement analytique = base de la refacturation).
        </div>
      )}
      <div className="form-r">
        <div className="form-g"><label>Site / Chantier <span style={{ color: 'var(--tm)', fontWeight: 400 }}>— 3ᵉ axe analytique</span></label>
          <select value={f.site ?? ''} onChange={set('site')}>
            <option value="">— Aucun —</option>
            {siteOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="form-r">
        <div className="form-g"><label>Commentaire <span style={{ color: 'var(--tm)', fontWeight: 400 }}>— report / changement d&apos;itinéraire / justification</span></label>
          <textarea value={f.comment ?? ''} onChange={(e) => setF((s) => ({ ...s, comment: e.target.value }))} rows={2}
            style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--bd)', borderRadius: 'var(--rs)', fontSize: '.78rem', background: 'var(--s1)', color: 'var(--tp)', resize: 'vertical' }} />
        </div>
      </div>
      <div className="tc" style={{ marginTop: 8 }}>
        <div className="th"><h3 style={{ fontSize: '.78rem' }}>Simulation Frais de Mission</h3><div className="sub">{preview.cat} · {preview.zoneBareme}</div></div>
        <table style={{ width: '100%', fontSize: '.72rem', borderCollapse: 'collapse' }}>
          <tbody>{preview.lines.map((l, i) => <tr key={i} style={{ borderBottom: '1px solid var(--bl)' }}><td style={{ padding: '4px 6px' }}>{l.label}</td><td style={{ padding: '4px 6px', color: 'var(--tm)' }}>{l.detail}</td><td style={{ padding: '4px 6px', textAlign: 'right' }}>{fk(l.montant)} DA</td></tr>)}</tbody>
          <tfoot><tr style={{ background: 'var(--a0)' }}><td colSpan={2} style={{ padding: 6, fontWeight: 700, color: 'var(--a6)' }}>TOTAL ESTIMÉ</td><td style={{ padding: 6, textAlign: 'right', fontWeight: 700, color: 'var(--a6)' }}>{fk(preview.total)} DA</td></tr></tfoot>
        </table>
      </div>
    </Modal>
  );
}
