'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import ComboBox from '@/components/ui/ComboBox';
import PlateInput, { isPlateValid } from '@/components/ui/PlateInput';
import DateInput from '@/components/ui/DateInput';
import { useConfig, useConfirmedRemove, useCreate, useMountTireSet, useUpdate } from '@/lib/api/hooks';
import { positionsFor } from '@/lib/reference/tirePositions';
import { normalizeVehicleLists, type VehicleLists } from '@/lib/reference/vehicleLists';
import { CAR_MAKES, modelsFor } from '@/lib/reference/carCatalog';
import { useSiteNames, withCurrentSite } from '@/lib/reference/sites';
import type { Driver, Vehicle } from '@/lib/types';

const check = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="20 6 9 17 4 12" /></svg>;
const arrow = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>;
const back = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>;
const truckIco = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 13l1.6-4.5A2 2 0 0 1 6.5 7H14v9" /><path d="M14 10h4l3 4v2h-2" /><circle cx="7.5" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></svg>;
const enginIco = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 5.5a4 4 0 0 0-5.3 5.3L4 16l4 4 5.2-5.2a4 4 0 0 0 5.3-5.3l-2.6 2.6-2.8-2.8Z" /></svg>;

const STATUS_LABEL: Record<string, [string, string]> = {
  DISPONIBLE: ['Disponible', 'ok'],
  EN_MISSION: ['En mission', 'mis'],
  EN_PANNE: ['En panne', 'bad'],
  EN_MAINTENANCE: ['Maintenance', 'warn'],
  HORS_SERVICE: ['Hors service', 'bad'],
};

interface Props {
  open: boolean;
  onClose: () => void;
  vehicle: Vehicle | null; // null => création
  vehicleCount: number;
  drivers: Driver[];
}

type FormState = Record<string, string | number | boolean | null>;

const STEPS = ['Identité', 'Exploitation', 'Documents'] as const;
const todayIso = () => new Date().toISOString().slice(0, 10);

/** Petite pastille de statut « à jour / bientôt / expiré / N/A » calculée sur l'échéance. */
function docBadge(status: string, expiry: string) {
  if (status === 'N/A') return <span className="bg bg-t" style={{ marginLeft: 8, fontSize: '.6rem' }}>Non applicable</span>;
  if (!expiry) return null;
  const days = Math.round((new Date(expiry).getTime() - Date.now()) / 86_400_000);
  if (Number.isNaN(days)) return null;
  const [cls, txt] = days < 0 ? ['bg-r', `expiré depuis ${-days} j`] : days <= 60 ? ['bg-a', `échéance dans ${days} j`] : ['bg-g', 'à jour'];
  return <span className={`bg ${cls}`} style={{ marginLeft: 8, fontSize: '.6rem' }}>{txt}</span>;
}

function initial(v: Vehicle | null, count: number): FormState {
  return {
    code: v?.code ?? `FL-${String(count + 80).padStart(3, '0')}`,
    brand: v?.brand ?? '',
    model: v?.model ?? '',
    type: v?.type ?? 'LEGER',
    genre: v?.genre ?? 'VIP',
    plate: v?.plate ?? '',
    fuel: v?.fuel ?? 'GASOIL',
    ownership: v?.ownership ?? 'PROPRE',
    lessor: v?.lessor ?? '',
    fiscalPower: v?.fiscalPower ?? '',
    chassis: v?.chassis ?? '',
    siteBase: v?.siteBase ?? '',
    seats: v?.seats ?? '',
    tireCount: v?.tireCount ?? '',
    maxTonnage: v?.maxTonnage ?? '',
    status: v?.status ?? 'DISPONIBLE',
    breakdownStatus: v?.breakdownStatus ?? 'non_pris_en_charge',
    repairEta: v?.repairEta ?? '',
    leaseStart: v?.leaseStart ?? '',
    leaseEnd: v?.leaseEnd ?? '',
    leaseCost: v?.leaseCost ?? '',
    ownedDailyCost: v?.ownedDailyCost ?? '',
    leaseAlertDays: v?.leaseAlertDays ?? 30,
    km: v?.km ?? '',
    tankLiters: v?.tankLiters ?? '',
    normOff: (v?.type === 'ENGIN' ? v?.normOffH : v?.normOff) ?? '',
    normCorrectionPct: v?.normCorrectionPct ?? 5,
    breakdownHours: v?.breakdownHours ?? '',
    ctDate: v?.ctDate ?? '',
    ctExpiry: v?.ctExpiry ?? '',
    ctStatus: v?.ctStatus ?? 'VALIDE',
    insDate: v?.insDate ?? '',
    insPolicy: v?.insPolicy ?? '',
    insStatus: v?.insStatus ?? 'VALIDE',
    greyCard: v?.greyCard ?? '',
    vignette: v?.vignette ?? '',
    driverCode: v?.driverCode ?? '',
  };
}

export default function VehicleFormModal({ open, onClose, vehicle, vehicleCount, drivers }: Props) {
  const isEdit = !!vehicle;
  const [f, setF] = useState<FormState>(() => initial(vehicle, vehicleCount));
  const [step, setStep] = useState(0);
  const listsCfg = useConfig<VehicleLists>('VEHICLE_LISTS');
  const lists = normalizeVehicleLists(listsCfg.data);
  const create = useCreate<Vehicle>('vehicles');
  const update = useUpdate<Vehicle>('vehicles');
  const mountTires = useMountTireSet();
  const removeVehicle = useConfirmedRemove('vehicles', 'ce véhicule');

  // Pneumatiques initiaux (prélevés à la mise en service — retour DG).
  const tirePositions = useMemo(() => positionsFor(String(f.type)), [f.type]);
  type TireSpec = { reference: string; serialNumber: string; brand: string; dimensions: string };
  const emptyTire: TireSpec = { reference: '', serialNumber: '', brand: '', dimensions: '' };
  const [initTires, setInitTires] = useState<Record<string, TireSpec>>({});
  const setTire = (pos: string, k: keyof TireSpec, val: string) =>
    setInitTires((s) => ({ ...s, [pos]: { ...emptyTire, ...s[pos], [k]: val } }));

  // Re-initialise quand on ouvre sur un autre véhicule
  const [key, setKey] = useState(vehicle?.code ?? 'new');
  if (open && key !== (vehicle?.code ?? 'new')) {
    setKey(vehicle?.code ?? 'new');
    setF(initial(vehicle, vehicleCount));
    setInitTires({});
    setStep(0);
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setF((s) => ({ ...s, [k]: val }));
  };
  const setV = (k: string, val: FormState[string]) => setF((s) => ({ ...s, [k]: val }));

  /** Options d'une liste de référence, en gardant la valeur actuelle même si elle n'y figure plus. */
  const opts = (list: string[], current: unknown): string[] => {
    const c = current == null ? '' : String(current);
    return c && !list.includes(c) ? [c, ...list] : list;
  };

  const isLoc = f.ownership === 'LOCATION';
  const isEngin = f.type === 'ENGIN';
  const inPanne = f.status === 'EN_PANNE' || f.status === 'HORS_SERVICE' || f.status === 'EN_MAINTENANCE';
  const models = useMemo(() => modelsFor(String(f.brand)), [f.brand]);
  const siteNames = useSiteNames();

  // Site de rattachement : liste des sites connus (retour DG — pas de saisie libre).
  const siteField = (
    <Field label="Site de rattachement">
      <select value={String(f.siteBase)} onChange={set('siteBase')}>
        <option value="">— Aucun —</option>
        {withCurrentSite(siteNames, f.siteBase).map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
    </Field>
  );

  /** Renvoie un message d'erreur si l'étape n'est pas valide, sinon null. */
  const validateStep = (s: number): string | null => {
    if (s === 0) {
      if (!String(f.code).trim()) return 'Le code / immatriculation interne est obligatoire.';
      if (!String(f.brand).trim()) return 'La marque est obligatoire.';
      if (!String(f.model).trim()) return 'Le modèle est obligatoire.';
      if (!String(f.plate).trim()) return 'L’immatriculation est obligatoire.';
      if (!isPlateValid(String(f.plate))) return 'Immatriculation incomplète — format : 12345-116-16 (série – catégorie – wilaya 01 à 58).';
      if (!String(f.fuel).trim()) return 'Le carburant est obligatoire.';
      return null;
    }
    if (s === 2) {
      if (f.ctStatus !== 'N/A' && !String(f.ctDate).trim()) return 'Documents : la date du dernier contrôle technique est obligatoire.';
      if (f.ctStatus !== 'N/A' && !String(f.ctExpiry).trim()) return 'Documents : l’échéance du contrôle technique (prochaine visite) est obligatoire.';
      if (f.ctExpiry && f.ctDate && String(f.ctExpiry) < String(f.ctDate)) return 'Documents : l’échéance du contrôle technique doit suivre la date du dernier contrôle.';
      if (f.insStatus !== 'N/A' && !String(f.insDate).trim()) return 'Documents : la date de fin d’assurance est obligatoire.';
      if (f.insStatus !== 'N/A' && !String(f.insPolicy).trim()) return 'Documents : le n° de police d’assurance est obligatoire.';
      if (!String(f.greyCard).trim()) return 'Documents : la date de la carte grise est obligatoire.';
      if (!String(f.vignette).trim()) return 'Documents : la date de la visite technique est obligatoire.';
      return null;
    }
    return null;
  };

  const goStep = (target: number) => {
    if (target === step) return;
    if (target < step) { setStep(target); return; }
    // Avancer : valider toutes les étapes intermédiaires.
    for (let s = step; s < target; s++) {
      const err = validateStep(s);
      if (err) { setStep(s); toast.error(err); return; }
    }
    setStep(target);
  };

  const submit = async () => {
    // Identité (étape 0) : toujours bloquant. Documents (étape 2) : bloquant à la création,
    // simple avertissement en modification (véhicules existants sans papiers renseignés).
    const idErr = validateStep(0);
    if (idErr) { setStep(0); toast.error(idErr); return; }
    const docErr = validateStep(2);
    if (docErr) {
      if (!isEdit) { setStep(2); toast.error(docErr); return; }
      toast(docErr.replace('Documents : ', 'Document manquant — '));
    }
    const no = f.normOff === '' || f.normOff == null ? null : Number(f.normOff) || null;
    const pct = f.normCorrectionPct === '' || f.normCorrectionPct == null ? 5 : Number(f.normCorrectionPct) || 0;
    const nc = no == null ? null : Math.round(no * (1 + pct / 100) * 100) / 100;
    const body: Partial<Vehicle> = {
      code: String(f.code), brand: String(f.brand).trim(), model: String(f.model).trim(),
      type: f.type as Vehicle['type'], genre: (f.genre ? String(f.genre) : null) as Vehicle['genre'],
      plate: String(f.plate), fuel: String(f.fuel),
      status: f.status as Vehicle['status'], ownership: f.ownership as Vehicle['ownership'],
      lessor: isLoc ? (String(f.lessor) || null) : null,
      fiscalPower: f.fiscalPower === '' ? null : Number(f.fiscalPower) || null,
      chassis: String(f.chassis) || null, siteBase: String(f.siteBase) || null,
      seats: f.seats === '' ? null : Number(f.seats),
      tireCount: f.tireCount === '' ? null : Number(f.tireCount),
      maxTonnage: f.maxTonnage === '' ? null : Number(f.maxTonnage),
      breakdownStatus: inPanne ? String(f.breakdownStatus) as Vehicle['breakdownStatus'] : null,
      repairEta: inPanne ? (String(f.repairEta) || null) : null,
      km: f.km === '' ? null : Number(f.km) || 0, tankLiters: f.tankLiters === '' ? null : Number(f.tankLiters) || 0,
      normOff: isEngin ? null : no, normCorr: isEngin ? null : nc,
      normOffH: isEngin ? no : null, normCorrH: isEngin ? nc : null,
      normCorrectionPct: pct,
      breakdownHours: f.breakdownHours === '' ? null : Number(f.breakdownHours) || 0,
      leaseStart: isLoc ? (String(f.leaseStart) || null) : null,
      leaseEnd: isLoc ? (String(f.leaseEnd) || null) : null,
      leaseCost: isLoc ? Number(f.leaseCost) || 0 : null,
      ownedDailyCost: !isLoc ? (f.ownedDailyCost === '' ? null : Number(f.ownedDailyCost) || 0) : null,
      leaseAlertDays: Number(f.leaseAlertDays) || 30,
      ctDate: String(f.ctDate) || null, ctExpiry: String(f.ctExpiry) || null,
      ctStatus: (f.ctStatus === 'N/A' ? 'N/A' : (f.ctExpiry && String(f.ctExpiry) < todayIso() ? 'EXPIRE' : 'VALIDE')),
      insDate: String(f.insDate) || null, insPolicy: String(f.insPolicy) || null,
      insStatus: (f.insStatus === 'N/A' ? 'N/A' : (f.insDate && String(f.insDate) < todayIso() ? 'EXPIRE' : 'VALIDE')),
      greyCard: String(f.greyCard) || null, vignette: String(f.vignette) || null,
      driverCode: String(f.driverCode) || null,
    };
    try {
      if (isEdit) {
        await update.mutateAsync({ id: vehicle!.code, body });
      } else {
        await create.mutateAsync(body);
        const tires = tirePositions
          .map((pos) => ({ position: pos, ...(initTires[pos] ?? emptyTire) }))
          .filter((t) => t.reference.trim());
        if (tires.length) await mountTires.mutateAsync({ vehicleCode: String(f.code), tires });
      }
      toast.success(isEdit ? `${f.code} mis à jour` : `Véhicule ${f.code} ajouté`);
      onClose();
    } catch {
      toast.error('Erreur lors de l’enregistrement');
    }
  };

  const pending = create.isPending || update.isPending;
  const last = step === STEPS.length - 1;

  const vname = [f.brand, f.model].map((x) => String(x).trim()).filter(Boolean).join(' ');
  const [statusLabel, statusCls] = STATUS_LABEL[String(f.status)] ?? [String(f.status), ''];
  const pct = [34, 67, 100][step] ?? 34;

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={`${isEdit ? 'Modifier' : 'Ajouter'} un véhicule`}
      footer={
        <>
          {isEdit && (
            <button
              className="btn btn-r"
              style={{ marginRight: 'auto' }}
              onClick={async () => { await removeVehicle(vehicle!.code, `${vehicle!.code} ${vehicle!.brand ?? ''} ${vehicle!.model ?? ''}`.trim()); onClose(); }}
            >
              Supprimer
            </button>
          )}
          {step > 0
            ? <button className="btn btn-o" onClick={() => setStep(step - 1)}>{back} Précédent</button>
            : <button className="btn btn-o" onClick={onClose}>Annuler</button>}
          {!last && (
            <button className={`btn ${isEdit ? 'btn-o' : 'btn-p'}`} onClick={() => goStep(step + 1)}>Suivant {arrow}</button>
          )}
          {(last || isEdit) && (
            <button className="btn btn-p" onClick={submit} disabled={pending}>{check} {isEdit ? 'Mettre à jour' : 'Enregistrer'}</button>
          )}
        </>
      }
    >
      <div className="vfx">
      <div className="vfx-steps">
        {STEPS.map((label, i) => (
          <div key={label} style={{ display: 'contents' }}>
            {i > 0 && <span className={`vfx-rail${step >= i ? ' fill' : ''}`} />}
            <button
              type="button"
              className={`vfx-node${step === i ? ' on' : step > i ? ' done' : ''}`}
              disabled={!isEdit && i > step}
              onClick={() => goStep(i)}
            >
              <span className="vfx-dot">{step > i ? check : i + 1}</span>
              <span className="vfx-lbl">{label}</span>
            </button>
          </div>
        ))}
      </div>

      <div className="vfx-split">
      <div className="vfx-main">

      {step === 0 && (
        <div className="vf-pane" key="s0">
          <div className="form-r">
            <Field label="Code interne" req><input value={String(f.code)} readOnly={isEdit} onChange={set('code')} /></Field>
            <Field label="Immatriculation" req>
              <PlateInput value={String(f.plate)} onChange={(v) => setV('plate', v)} required />
            </Field>
          </div>
          <div className="form-r">
            <Field label="Marque" req>
              <ComboBox value={String(f.brand)} onChange={(v) => setV('brand', v)} options={CAR_MAKES}
                placeholder="Rechercher une marque…" ariaLabel="Marque" />
            </Field>
            <Field label="Modèle" req>
              <ComboBox value={String(f.model)} onChange={(v) => setV('model', v)} options={models}
                placeholder={f.brand ? 'Rechercher un modèle…' : 'Choisir la marque d’abord'}
                emptyHint={f.brand ? 'Modèle libre pour cette marque' : 'Choisissez d’abord une marque'}
                ariaLabel="Modèle" />
            </Field>
          </div>
          <div className="form-r">
            <Field label="Type">
              <select value={String(f.type)} onChange={set('type')}>
                {opts(lists.type, f.type).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Genre">
              <select value={String(f.genre)} onChange={set('genre')}>
                {opts(lists.genre, f.genre).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>
          <div className="form-r">
            <Field label="Carburant" req>
              <select value={String(f.fuel)} onChange={set('fuel')}>
                {opts(lists.fuel, f.fuel).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Propriété">
              <select value={String(f.ownership)} onChange={set('ownership')}>
                {opts(lists.ownership, f.ownership).map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>
          <div className="vf-hint">
            Type / Genre / Carburant / Propriété : listes modifiables dans <b>Paramètres › Listes Flotte</b>.
          </div>
          {isLoc && (
            <div className="form-r">
              <Field label="Bailleur"><input value={String(f.lessor)} placeholder="SOVAC, EURL SAADNA…" onChange={set('lessor')} /></Field>
              {siteField}
            </div>
          )}
          <div className="form-r">
            {!isLoc && siteField}
            <Field label="Puissance fiscale (CV)"><input type="number" value={f.fiscalPower === '' ? '' : Number(f.fiscalPower)} placeholder="7" onChange={set('fiscalPower')} /></Field>
            {isLoc && <Field label="N° de châssis (VIN)"><input value={String(f.chassis)} placeholder="VF1FW51J167221904" onChange={set('chassis')} /></Field>}
          </div>
          {siteNames.length === 0 && (
            <div className="vf-hint">Aucun site enregistré pour l’instant — un site apparaît ici dès qu’un véhicule y est rattaché ou affecté (Sites &amp; Engins).</div>
          )}
          <div className="form-r">
            {!isLoc && <Field label="N° de châssis (VIN)"><input value={String(f.chassis)} placeholder="VF1FW51J167221904" onChange={set('chassis')} /></Field>}
            <Field label="Personnes transportables (hors chauffeur)">
              <input type="number" min={0} value={f.seats === '' ? '' : Number(f.seats)} placeholder="4" onChange={set('seats')} />
            </Field>
          </div>
          <div className="vf-hint">Personnes transportables : borne le nombre de passagers autorisé lors de l’affectation d’une mission.</div>
        </div>
      )}

      {step === 1 && (
        <div className="vf-pane" key="s1">
          <div className="form-r">
            <Field label="Statut">
              <select value={String(f.status)} onChange={set('status')}>
                {['DISPONIBLE', 'EN_MISSION', 'EN_PANNE', 'EN_MAINTENANCE', 'HORS_SERVICE'].map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            {inPanne
              ? (
                <Field label="Prise en charge de la panne">
                  <select value={String(f.breakdownStatus)} onChange={set('breakdownStatus')}>
                    <option value="non_pris_en_charge">Non pris en charge</option>
                    <option value="pris_en_charge">Pris en charge</option>
                    <option value="en_reparation">En réparation</option>
                  </select>
                </Field>
              )
              : <Field label="Heures panne cumulées"><input type="number" value={f.breakdownHours === '' || f.breakdownHours == null ? '' : Number(f.breakdownHours)} onChange={set('breakdownHours')} placeholder="0" /></Field>}
          </div>
          {inPanne && (
            <div className="form-r">
              <Field label="Date prévisionnelle de remise en marche"><DateInput value={String(f.repairEta)} onChange={set('repairEta')} /></Field>
              <Field label="Heures panne cumulées"><input type="number" value={f.breakdownHours === '' || f.breakdownHours == null ? '' : Number(f.breakdownHours)} onChange={set('breakdownHours')} placeholder="0" /></Field>
            </div>
          )}
          <div className="form-r">
            <Field label="Kilométrage"><input type="number" value={f.km === '' || f.km == null ? '' : Number(f.km)} onChange={set('km')} placeholder="0" /></Field>
            <Field label="Plein max (litres)"><input type="number" value={f.tankLiters === '' || f.tankLiters == null ? '' : Number(f.tankLiters)} onChange={set('tankLiters')} placeholder="ex. 60" /></Field>
          </div>
          <div className="form-r">
            <Field label="Nombre de pneus">
              <input type="number" min={0} value={f.tireCount === '' ? '' : Number(f.tireCount)} placeholder={String(positionsFor(String(f.type)).filter((p) => !/secours/i.test(p)).length)} onChange={set('tireCount')} />
            </Field>
            <Field label="Tonnage max — charge utile (t)">
              <input type="number" step="0.1" min={0} value={f.maxTonnage === '' ? '' : Number(f.maxTonnage)} placeholder={f.type === 'LOURD' ? 'ex. 19' : '—'} onChange={set('maxTonnage')} />
            </Field>
          </div>
          <div className="vf-hint">Plein max : borne les opérations carburant. Tonnage : bloque l’affectation d’une mission dont le fret dépasse.</div>

          <div className="vf-sec">Norme de consommation ({isEngin ? 'L/h' : 'L/100 km'})</div>
          <div className="form-r">
            <Field label={`Norme constructeur (${isEngin ? 'L/h' : 'L/100km'})`}><input type="number" step="0.1" value={f.normOff === '' || f.normOff == null ? '' : Number(f.normOff)} onChange={set('normOff')} placeholder="ex. 8.5" /></Field>
            <Field label="% de correction"><input type="number" step="1" value={f.normCorrectionPct === '' || f.normCorrectionPct == null ? '' : Number(f.normCorrectionPct)} onChange={set('normCorrectionPct')} placeholder="5" /></Field>
          </div>
          {(() => {
            const no = f.normOff === '' || f.normOff == null ? null : Number(f.normOff);
            const pct = f.normCorrectionPct === '' || f.normCorrectionPct == null ? 5 : Number(f.normCorrectionPct);
            const nc = no == null ? null : Math.round(no * (1 + pct / 100) * 100) / 100;
            return (
              <div className="vf-note">
                Norme retenue = <b style={{ color: 'var(--tp)' }}>{nc != null ? `${nc} ${isEngin ? 'L/h' : 'L/100km'}` : '—'}</b>
                {' '}<span style={{ opacity: .8 }}>= {no ?? '?'} × (1 + {pct}%)</span>. Seuil d’alerte conso = norme retenue + 15 %.
              </div>
            );
          })()}

          <div className="vf-sec">Coût du véhicule (refacturation)</div>
          {isLoc ? (
            <>
              <div className="form-r">
                <Field label="Date début location"><DateInput value={String(f.leaseStart)} onChange={set('leaseStart')} /></Field>
                <Field label="Date fin location"><DateInput value={String(f.leaseEnd)} onChange={set('leaseEnd')} /></Field>
              </div>
              <div className="form-r">
                <Field label="Coût mensuel location (DA)"><input type="number" value={f.leaseCost === '' || f.leaseCost == null ? '' : Number(f.leaseCost)} onChange={set('leaseCost')} placeholder="0" /></Field>
                <Field label="Alerte (jours avant échéance)"><input type="number" value={f.leaseAlertDays === '' || f.leaseAlertDays == null ? '' : Number(f.leaseAlertDays)} onChange={set('leaseAlertDays')} placeholder="30" /></Field>
              </div>
            </>
          ) : (
            <>
              <div className="form-r">
                <Field label="Coût quotidien — journée 8 h (DA)">
                  <input type="number" value={f.ownedDailyCost === '' || f.ownedDailyCost == null ? '' : Number(f.ownedDailyCost)} onChange={set('ownedDailyCost')} placeholder="ex. 8 000" />
                </Field>
                <div />
              </div>
              <div className="vf-note">
                {f.ownedDailyCost
                  ? `→ ${Math.round(Number(f.ownedDailyCost))} DA/jour · ${Math.round(Number(f.ownedDailyCost) / 8)} DA/heure · ≈ ${Math.round(Number(f.ownedDailyCost) * 22)} DA/mois (22 j ouvrés)`
                  : 'Coût quotidien 8 h du véhicule propre — comme le prix de location d’un véhicule loué. Sans coût, le véhicule ne sera pas refacturé.'}
              </div>
            </>
          )}

          {!isEdit && f.type !== 'REMORQUE' && (
            <>
              <div className="vf-sec">Pneumatiques à la mise en service <span style={{ fontWeight: 400, color: 'var(--tm)' }}>— {tirePositions.length} positions (facultatif)</span></div>
              <div className="tw"><table style={{ fontSize: '.72rem' }}>
                <thead><tr><th>Position</th><th>Référence</th><th>N° série</th><th>Marque</th><th>Dimensions</th></tr></thead>
                <tbody>
                  {tirePositions.map((pos) => (
                    <tr key={pos}>
                      <td style={{ fontWeight: 600 }}>{pos}</td>
                      <td><input value={initTires[pos]?.reference ?? ''} onChange={(e) => setTire(pos, 'reference', e.target.value)} placeholder="ex. MICH-XZE2" /></td>
                      <td><input value={initTires[pos]?.serialNumber ?? ''} onChange={(e) => setTire(pos, 'serialNumber', e.target.value)} /></td>
                      <td><input value={initTires[pos]?.brand ?? ''} onChange={(e) => setTire(pos, 'brand', e.target.value)} /></td>
                      <td><input value={initTires[pos]?.dimensions ?? ''} onChange={(e) => setTire(pos, 'dimensions', e.target.value)} placeholder="315/80 R22.5" /></td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="vf-pane" key="s2">
          <div className="vf-hint">Documents obligatoires du véhicule. Le statut se calcule tout seul sur l’échéance ; une échéance dépassée ou proche (&lt; 60 j) génère une <b>alerte</b>. Marquez « Non applicable » si un document ne concerne pas ce véhicule (remorque…).</div>

          <div className="vf-sec">Contrôle technique {docBadge(String(f.ctStatus), String(f.ctExpiry))}</div>
          <div className="form-r">
            <Field label="Date du dernier contrôle" req={f.ctStatus !== 'N/A'}><DateInput value={String(f.ctDate)} onChange={set('ctDate')} /></Field>
            <Field label="Échéance — prochaine visite" req={f.ctStatus !== 'N/A'}><DateInput value={String(f.ctExpiry)} min={String(f.ctDate) || undefined} onChange={set('ctExpiry')} /></Field>
          </div>
          <label style={{ fontSize: '.72rem', color: 'var(--tm)', display: 'flex', alignItems: 'center', gap: 6, margin: '-4px 0 4px' }}>
            <input type="checkbox" checked={f.ctStatus === 'N/A'} onChange={(e) => setV('ctStatus', e.target.checked ? 'N/A' : 'VALIDE')} /> Contrôle technique non applicable à ce véhicule
          </label>

          <div className="vf-sec">Assurance {docBadge(String(f.insStatus), String(f.insDate))}</div>
          <div className="form-r">
            <Field label="Date de fin d’assurance" req={f.insStatus !== 'N/A'}><DateInput value={String(f.insDate)} onChange={set('insDate')} /></Field>
            <Field label="N° police d’assurance" req={f.insStatus !== 'N/A'}><input value={String(f.insPolicy)} placeholder="ASS-2024-XXXX" onChange={set('insPolicy')} /></Field>
          </div>
          <label style={{ fontSize: '.72rem', color: 'var(--tm)', display: 'flex', alignItems: 'center', gap: 6, margin: '-4px 0 4px' }}>
            <input type="checkbox" checked={f.insStatus === 'N/A'} onChange={(e) => setV('insStatus', e.target.checked ? 'N/A' : 'VALIDE')} /> Assurance non applicable à ce véhicule
          </label>

          <div className="vf-sec">Autres documents</div>
          <div className="form-r">
            <Field label="Chauffeur affecté">
              <select value={String(f.driverCode)} onChange={set('driverCode')}>
                <option value="">— Aucun —</option>
                {drivers.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
              </select>
            </Field>
          </div>
          <div className="form-r">
            <Field label="Date carte grise" req><DateInput value={String(f.greyCard)} onChange={set('greyCard')} /></Field>
            <Field label="Date visite technique" req><DateInput value={String(f.vignette)} onChange={set('vignette')} /></Field>
          </div>
        </div>
      )}

      </div>

      <aside className="vfx-aside">
        <div className="vfx-card">
          <div className="vfx-card-hd">
            <span className="vfx-ico">{isEngin ? enginIco : truckIco}</span>
            <div>
              <b>{vname || 'Nouveau véhicule'}</b>
              <span>{String(f.code) || '—'} · {String(f.type)}</span>
            </div>
          </div>
          <div className="vfx-plate">{String(f.plate).trim() || '— · — · —'}</div>
          <div className="vfx-rows">
            <div className="vfx-row"><span>Carburant</span><b>{String(f.fuel) || '—'}</b></div>
            <div className="vfx-row"><span>Propriété</span><b>{isLoc && f.lessor ? `Location — ${String(f.lessor)}` : String(f.ownership) || '—'}</b></div>
            <div className="vfx-row"><span>Site</span><b>{String(f.siteBase) || '—'}</b></div>
            <div className="vfx-row"><span>Statut</span><b className={statusCls}>{statusLabel}</b></div>
          </div>
          <div className="vfx-tags">
            {String(f.genre).trim() && <span className="vfx-tag">{String(f.genre)}</span>}
            {f.seats !== '' && f.seats != null && <span className="vfx-tag">{Number(f.seats)} places</span>}
            {f.fiscalPower !== '' && f.fiscalPower != null && <span className="vfx-tag">{Number(f.fiscalPower)} CV</span>}
          </div>
          <div className="vfx-prog">
            <div className="vfx-prog-bar"><i style={{ width: `${pct}%` }} /></div>
            <small>Étape {step + 1} / {STEPS.length} — {STEPS[step]}</small>
          </div>
        </div>
      </aside>

      </div>
      </div>
    </Modal>
  );
}

function Field({ label, req, children }: { label: string; req?: boolean; children: React.ReactNode }) {
  return (
    <div className="form-g">
      <label>{label} {req && <span style={{ color: 'var(--r5)' }}>*</span>}</label>
      {children}
    </div>
  );
}
