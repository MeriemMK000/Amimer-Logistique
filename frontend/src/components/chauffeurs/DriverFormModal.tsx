'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import BuCcSelect from '@/components/ui/BuCcSelect';
import PlaceInput, { type PlaceGeo } from '@/components/ui/PlaceInput';
import DateInput from '@/components/ui/DateInput';
import { geoRoute, useCreate, useUpdate } from '@/lib/api/hooks';
import { useSiteNames, withCurrentSite } from '@/lib/reference/sites';
import type { Driver, Vehicle } from '@/lib/types';

const DEFAULT_PLAN = [
  { t: 'DIS', h1: '', h2: '' }, { t: 'DIS', h1: '', h2: '' }, { t: 'DIS', h1: '', h2: '' },
  { t: 'DIS', h1: '', h2: '' }, { t: 'DIS', h1: '', h2: '' }, { t: 'DIS', h1: '', h2: '' },
  { t: 'REP', h1: '', h2: '' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  driver: Driver | null;
  driverCount: number;
  vehicles: Vehicle[];
  qualifications: { code: string; label: string }[];
}

type F = Record<string, string | number | boolean | string[] | null>;

function initial(d: Driver | null, count: number): F {
  const x = d as (Driver & { apteMission?: boolean; dedicatedTo?: string; dedicatedCa?: string; workLocation?: string; maxWeeklyHours?: number }) | null;
  return {
    code: x?.code ?? `EMP-${130 + count}`,
    name: x?.name ?? '',
    license: x?.license ?? 'B',
    licenseExpiry: x?.licenseExpiry ?? '',
    quals: x?.quals ?? [],
    status: x?.status ?? 'DISPONIBLE',
    vehicleCode: x?.vehicleCode ?? '',
    permanent: !!x?.permanent,
    phone: x?.phone ?? '',
    personType: (x as { personType?: string })?.personType ?? 'chauffeur',
    hourlyCost: x?.hourlyCost ?? '',
    dailyCost: (x as { dailyCost?: number })?.dailyCost ?? '',
    apteMission: x?.apteMission ?? true,
    dedicatedTo: x?.dedicatedTo ?? '',
    dedicatedCa: x?.dedicatedCa ?? '',
    workLocation: x?.workLocation ?? '',
    maxWeeklyHours: x?.maxWeeklyHours ?? 48,
    address: (x as { address?: string })?.address ?? '',
    workDistanceKm: (x as { workDistanceKm?: number })?.workDistanceKm ?? '',
  };
}

export default function DriverFormModal({ open, onClose, driver, driverCount, vehicles, qualifications }: Props) {
  const isEdit = !!driver;
  const [f, setF] = useState<F>(() => initial(driver, driverCount));
  // Adresse domicile : coordonnées précises (Google Maps) pour calculer la distance domicile ↔ base.
  const [addressGeo, setAddressGeo] = useState<PlaceGeo | null>(null);
  const [distManual, setDistManual] = useState<boolean>(() => !!(driver as { workDistanceKm?: number } | null)?.workDistanceKm);
  const [distStatus, setDistStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [key, setKey] = useState(driver?.code ?? 'new');
  if (open && key !== (driver?.code ?? 'new')) {
    setKey(driver?.code ?? 'new');
    setF(initial(driver, driverCount));
    setAddressGeo(null);
    setDistManual(!!(driver as { workDistanceKm?: number } | null)?.workDistanceKm);
    setDistStatus('idle');
  }
  const set = (k: string, v: F[string]) => setF((s) => ({ ...s, [k]: v }));

  // Distance domicile ↔ lieu de travail : calcul automatique (routier, Google Maps) dès que
  // l'adresse et la base sont renseignées — sauf si l'utilisateur a saisi une valeur à la main.
  const addr = String(f.address).trim();
  const wl = String(f.workLocation).trim();
  useEffect(() => {
    if (distManual || !addr || !wl) return;
    let alive = true;
    const t = setTimeout(async () => {
      if (!alive) return;
      setDistStatus('loading');
      try {
        const r = await geoRoute([addressGeo ?? addr, wl]);
        if (!alive) return;
        if (r && r.km > 0) { setF((s) => ({ ...s, workDistanceKm: r.km })); setDistStatus('done'); }
        else setDistStatus('error');
      } catch { if (alive) setDistStatus('error'); }
    }, 600);
    return () => { alive = false; clearTimeout(t); };
  }, [addr, wl, addressGeo, distManual]);
  const quals = (f.quals as string[]) ?? [];
  const siteNames = useSiteNames();
  const isChauffeur = f.personType !== 'utilisateur';

  const create = useCreate<Driver>('drivers');
  const update = useUpdate<Driver>('drivers');

  const submit = async () => {
    if (!f.code || !String(f.name).trim()) { toast.error('Champs obligatoires : N° Employé, Nom Complet'); return; }
    if (!String(f.licenseExpiry)) { toast.error('La date d’expiration du permis est obligatoire.'); return; }
    if (!String(f.phone).trim()) { toast.error('Le téléphone est obligatoire.'); return; }
    if (isChauffeur && (f.dailyCost === '' || f.dailyCost == null) && (f.hourlyCost === '' || f.hourlyCost == null)) {
      toast.error('Renseignez le coût du chauffeur — horaire ou journalier (l’autre se calcule).'); return;
    }
    const base: Partial<Driver> = {
      code: String(f.code), name: String(f.name).trim(), license: String(f.license),
      licenseExpiry: String(f.licenseExpiry), quals,
      status: f.status as Driver['status'], vehicleCode: String(f.vehicleCode) || null,
      permanent: !!f.permanent, phone: String(f.phone).trim(),
      ...({
        personType: f.personType === 'utilisateur' ? 'utilisateur' : 'chauffeur',
        hourlyCost: f.hourlyCost === '' ? null : Number(f.hourlyCost) || 0,
        dailyCost: f.dailyCost === '' ? null : Number(f.dailyCost) || 0,
        apteMission: f.personType === 'utilisateur' ? false : !!f.apteMission,
        dedicatedTo: String(f.dedicatedTo) || null,
        dedicatedCa: String(f.dedicatedCa) || null,
        workLocation: String(f.workLocation) || null,
        maxWeeklyHours: Number(f.maxWeeklyHours) || 48,
        address: String(f.address) || null,
        workDistanceKm: Number(f.workDistanceKm) || 0,
      } as Partial<Driver>),
    };
    try {
      if (isEdit) await update.mutateAsync({ id: driver!.code, body: base });
      else await create.mutateAsync({ ...base, hoursWeek: 0, hoursMonth: 0, fatigue: 0, plan: DEFAULT_PLAN as never });
      toast.success(isEdit ? `${f.code} mis à jour` : `Chauffeur ${f.code} ajouté`);
      onClose();
    } catch { toast.error('Erreur lors de l’enregistrement'); }
  };

  const toggleQual = (q: string) => set('quals', quals.includes(q) ? quals.filter((x) => x !== q) : [...quals, q]);

  return (
    <Modal open={open} onClose={onClose} title={`${isEdit ? 'Modifier' : 'Ajouter'} Chauffeur`} wide
      footer={<><button className="btn btn-o" onClick={onClose}>Annuler</button><button className="btn btn-p" onClick={submit}>{isEdit ? 'Mettre à jour' : 'Enregistrer'}</button></>}>
      <div className="form-r">
        <div className="form-g"><label>N° Employé *</label><input value={String(f.code)} readOnly={isEdit} onChange={(e) => set('code', e.target.value)} /></div>
        <div className="form-g"><label>Nom Complet *</label><input value={String(f.name)} placeholder="Nom Prénom" onChange={(e) => set('name', e.target.value)} /></div>
      </div>
      <div className="form-g">
        <label>Type</label>
        <select value={String(f.personType)} onChange={(e) => set('personType', e.target.value)}>
          <option value="chauffeur">Chauffeur — conduit des véhicules en mission</option>
          <option value="utilisateur">Utilisateur — voiture de service, ne part pas en mission</option>
        </select>
        {f.personType === 'utilisateur' && (
          <div style={{ fontSize: '.68rem', color: 'var(--tm)', marginTop: 3 }}>
            Un utilisateur (directeur, cadre…) n&apos;apparaît pas dans la sélection des missions et n&apos;a pas de suivi de fatigue.
          </div>
        )}
      </div>
      <div className="form-r">
        <div className="form-g"><label>Permis</label><select value={String(f.license)} onChange={(e) => set('license', e.target.value)}>{['B', 'C', 'C+E', 'D'].map((l) => <option key={l}>{l}</option>)}</select></div>
        <div className="form-g"><label>Exp. Permis <span style={{ color: 'var(--r5)' }}>*</span></label><DateInput value={String(f.licenseExpiry)} onChange={(e) => set('licenseExpiry', e.target.value)} /></div>
      </div>
      <div className="form-g">
        <label>Qualifications (paramétrées dans l&apos;onglet Qualifications)</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {qualifications.map((q) => (
            <button key={q.code} type="button" className={`fc${quals.includes(q.code) ? ' act' : ''}`} onClick={() => toggleQual(q.code)} title={q.label}>{q.code}</button>
          ))}
          {!qualifications.length && <span style={{ fontSize: '.72rem', color: 'var(--tm)' }}>Aucune qualification définie.</span>}
        </div>
      </div>
      <div className="form-r">
        <div className="form-g"><label>Téléphone <span style={{ color: 'var(--r5)' }}>*</span></label><input value={String(f.phone)} placeholder="0555 00 00 00" onChange={(e) => set('phone', e.target.value)} /></div>
        <div className="form-g"><label>Lieu de travail (base)</label>
          <select value={String(f.workLocation)} onChange={(e) => set('workLocation', e.target.value)}>
            <option value="">— Aucun —</option>
            {withCurrentSite(siteNames, f.workLocation).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      {f.personType !== 'utilisateur' && (
        <>
          <div style={{ fontSize: '.68rem', color: 'var(--tm)', marginBottom: 6 }}>
            <b>Coût du chauffeur</b> — sert à facturer les heures (missions + heures travaillées sur site). Saisis l&apos;un des deux, l&apos;autre se déduit.
          </div>
          <div className="form-r">
            <div className="form-g"><label>Coût horaire (DA/h)</label>
              <input type="number" value={f.hourlyCost === '' || f.hourlyCost == null ? '' : Number(f.hourlyCost)}
                onChange={(e) => {
                  const v = e.target.value;
                  setF((s) => ({ ...s, hourlyCost: v, dailyCost: v === '' ? s.dailyCost : Math.round(Number(v) * 8) }));
                }} placeholder="ex. 900" /></div>
            <div className="form-g"><label>Coût journalier — 8 h (DA) <span style={{ color: 'var(--tm)', fontWeight: 400 }}>— ou saisir le coût horaire</span></label>
              <input type="number" value={f.dailyCost === '' || f.dailyCost == null ? '' : Number(f.dailyCost)}
                onChange={(e) => {
                  const v = e.target.value;
                  setF((s) => ({ ...s, dailyCost: v, hourlyCost: v === '' ? s.hourlyCost : Math.round(Number(v) / 8) }));
                }} placeholder="ex. 7 200" /></div>
          </div>
          <div style={{ fontSize: '.66rem', color: 'var(--tm)', marginBottom: 8 }}>
            {f.dailyCost ? `→ ${Math.round(Number(f.dailyCost))} DA/jour · ${Math.round(Number(f.dailyCost) / 8)} DA/heure (calcul auto)`
              : f.hourlyCost ? `→ ${Math.round(Number(f.hourlyCost))} DA/heure · ${Math.round(Number(f.hourlyCost) * 8)} DA/jour (8 h)`
                : 'Aucun coût défini → les heures de ce chauffeur ne seront pas facturées.'}
          </div>
        </>
      )}
      <div className="form-r">
        <div className="form-g"><label>Adresse réelle (domicile)</label>
          <PlaceInput
            value={String(f.address)} geo={addressGeo}
            onChange={(name, geo) => { setF((s) => ({ ...s, address: name })); setAddressGeo(geo); setDistManual(false); }}
            placeholder="Rue, cité, quartier… (recherche adresse)" />
        </div>
        <div className="form-g"><label>Distance domicile ↔ lieu de travail (km, aller simple)
          {!distManual && <span style={{ color: 'var(--tm)', fontWeight: 400 }}> — auto</span>}</label>
          <div style={{ display: 'flex', gap: 4 }}>
            <input type="number" step="0.5" style={{ flex: 1 }}
              value={f.workDistanceKm === '' || f.workDistanceKm == null ? '' : Number(f.workDistanceKm)}
              onChange={(e) => { setDistManual(true); set('workDistanceKm', e.target.value === '' ? null : Number(e.target.value)); }} />
            <button type="button" className="btn btn-o btn-sm" title="Recalculer d'après l'adresse et la base"
              onClick={() => { setDistManual(false); set('workDistanceKm', null); }}
              disabled={!distManual && distStatus !== 'error'}>↻</button>
          </div>
          <div style={{ fontSize: '.64rem', marginTop: 2, color: !distManual && addr && wl && distStatus === 'error' ? 'var(--a6)' : 'var(--tm)' }}>
            {distManual ? 'Saisie manuelle.'
              : !addr || !wl ? 'Renseigne l’adresse + le lieu de travail → distance calculée automatiquement.'
                : distStatus === 'loading' ? 'Calcul de l’itinéraire…'
                  : distStatus === 'error' ? 'Itinéraire introuvable — saisis la distance à la main.'
                    : 'Distance routière calculée automatiquement.'}
          </div>
        </div>
      </div>
      <div className="form-r">
        <div className="form-g"><label>Véhicule Affecté</label>
          <select value={String(f.vehicleCode)} onChange={(e) => set('vehicleCode', e.target.value)}>
            <option value="">— Aucun —</option>
            {vehicles.filter((v) => v.type !== 'ENGIN' && v.type !== 'REMORQUE').map((v) => <option key={v.code} value={v.code}>{v.code} — {v.brand} {v.model}</option>)}
          </select>
        </div>
        <div className="form-g" />
      </div>
      <div className="form-g" style={{ marginBottom: 4 }}>
        <label>Chauffeur dédié à <span style={{ color: 'var(--tm)', fontWeight: 400 }}>— rattachement Business Unit / centre de coût (référentiel), pour la refacturation</span></label>
      </div>
      <BuCcSelect
        bu={String(f.dedicatedTo) || null} cc={String(f.dedicatedCa) || null}
        onChange={(bu, cc) => setF((s) => ({ ...s, dedicatedTo: bu ?? '', dedicatedCa: cc ?? '' }))}
        buLabel="Dédié à la BU" ccLabel="Centre de coût" noneLabel="— Non dédié —" />
      <div className="form-r">
        <div className="form-g"><label>Heures max / semaine</label><input type="number" value={f.maxWeeklyHours === '' || f.maxWeeklyHours == null ? '' : Number(f.maxWeeklyHours)} onChange={(e) => set("maxWeeklyHours", e.target.value === "" ? null : Number(e.target.value))} /></div>
        <div className="form-g" />
      </div>
      <div className="form-r">
        <div className="form-g"><label><input type="checkbox" checked={!!f.permanent} onChange={(e) => set('permanent', e.target.checked)} /> Affectation permanente</label></div>
        <div className="form-g"><label><input type="checkbox" checked={!!f.apteMission} onChange={(e) => set('apteMission', e.target.checked)} /> Apte à partir en mission</label></div>
      </div>
    </Modal>
  );
}
