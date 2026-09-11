'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import BuCcSelect from '@/components/ui/BuCcSelect';
import DateInput from '@/components/ui/DateInput';
import { useOrgOptions, withCurrentOrg } from '@/lib/reference/org';
import { useCreate, useUpdate } from '@/lib/api/hooks';
import type { Driver, Vehicle, VehicleAssignment } from '@/lib/types';

/**
 * Déclaration / édition d'une voiture de service (voiture de fonction) : un véhicule attribué
 * en permanence à une personne. Écrit dans `vehicle_assignments` (kind = permanent, assigneeName
 * renseigné) — la même table que « Sites & Engins → Affectations ».
 * Retour DG : la BU + le centre de coût servent à la refacturation, et ces véhicules sont
 * exclus de la sélection des missions.
 */
export default function ServiceCarFormModal({ open, onClose, assignment, vehicles, drivers }: {
  open: boolean;
  onClose: () => void;
  assignment: VehicleAssignment | null;
  vehicles: Vehicle[];
  drivers: Driver[];
}) {
  const isEdit = !!assignment;
  const seed = (): Record<string, unknown> => {
    const a = (assignment ?? {}) as Record<string, unknown>;
    return {
      kind: 'permanent', withDriver: false, note: 'Voiture de fonction', ...a,
      // « Plafond carburant » = choix explicite plafonné / non plafonné (retour DG).
      fuelCapMode: a.monthlyFuelCap != null ? 'capped' : (assignment ? 'uncapped' : ''),
    };
  };
  const [f, setF] = useState<Record<string, unknown>>(seed);
  const [key, setKey] = useState(assignment?.id ?? 'new');
  if (open && key !== (assignment?.id ?? 'new')) {
    setKey(assignment?.id ?? 'new');
    setF(seed());
  }
  const set = (k: string, v: unknown) => setF((s) => ({ ...s, [k]: v }));
  const str = (k: string) => (f[k] == null ? '' : String(f[k]));
  const num = (k: string): number | null => (str(k) === '' ? null : Number(f[k]));

  const create = useCreate<VehicleAssignment>('vehicle-assignments');
  const update = useUpdate<VehicleAssignment>('vehicle-assignments');
  const org = useOrgOptions();

  // Une voiture de service est une voiture, pas un engin / une remorque.
  const carList = vehicles.filter((v) => v.type !== 'ENGIN' && v.type !== 'REMORQUE');
  const withDriver = !!f.withDriver;

  const capped = f.fuelCapMode === 'capped';

  const submit = async () => {
    // Retour DG : tous les champs obligatoires sauf « N° carte carburant ».
    if (!str('vehicleCode')) { toast.error('Choisir un véhicule'); return; }
    if (!str('assigneeName').trim()) { toast.error('Renseigner la personne (« Attribuée à »)'); return; }
    if (!str('structure').trim()) { toast.error('La structure est obligatoire'); return; }
    if (!str('businessUnit')) { toast.error('La Business Unit est obligatoire (refacturation)'); return; }
    if (!str('costCenter')) { toast.error('Le centre de coût est obligatoire (refacturation)'); return; }
    if (withDriver && !str('driverCode')) { toast.error('Choisir le chauffeur dédié'); return; }
    if (!str('dateStart')) { toast.error('La date de début est obligatoire'); return; }
    if (str('dateEnd') && str('dateEnd') < str('dateStart')) { toast.error('La date de fin doit suivre la date de début'); return; }
    if (str('dailyHomeKm') === '') { toast.error('Le trajet domicile (km / jour) est obligatoire'); return; }
    if (!f.fuelCapMode) { toast.error('Indiquez si le carburant est plafonné ou non'); return; }
    if (capped && !(Number(f.monthlyFuelCap) > 0)) { toast.error('Renseignez le montant du plafond carburant mensuel'); return; }
    if (!str('note').trim()) { toast.error('La note est obligatoire'); return; }
    const body: Partial<VehicleAssignment> = {
      vehicleCode: str('vehicleCode'),
      kind: 'permanent',
      assigneeName: str('assigneeName').trim(),
      structure: str('structure').trim() || null,
      businessUnit: str('businessUnit') || null,
      costCenter: str('costCenter') || null,
      withDriver,
      driverCode: withDriver ? (str('driverCode') || null) : null,
      dateStart: str('dateStart') || null,
      dateEnd: str('dateEnd') || null,
      dailyHomeKm: num('dailyHomeKm'),
      fuelCardNumber: str('fuelCardNumber') || null,
      monthlyFuelCap: capped ? Number(f.monthlyFuelCap) : null,
      siteCode: null,
      note: str('note').trim() || 'Voiture de fonction',
    };
    try {
      if (isEdit) await update.mutateAsync({ id: assignment!.id, body });
      else await create.mutateAsync(body);
      toast.success(isEdit ? 'Voiture de service mise à jour' : 'Voiture de service déclarée');
      onClose();
    } catch (e) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erreur');
    }
  };

  return (
    <Modal open={open} onClose={onClose} wide
      title={isEdit ? 'Modifier la voiture de service' : 'Déclarer une voiture de service'}
      footer={<><button className="btn btn-o" onClick={onClose}>Annuler</button>
        <button className="btn btn-p" onClick={submit} disabled={create.isPending || update.isPending}>{isEdit ? 'Mettre à jour' : 'Enregistrer'}</button></>}>
      <div style={{ fontSize: '.72rem', color: 'var(--tm)', marginBottom: 10 }}>
        Ce véhicule sera <b>rattaché à une personne</b> et <b>exclu de la sélection des missions</b>.
        Le coût du véhicule (défini sur sa fiche) et le carburant sont refacturés à la BU / au centre de coût indiqués.
      </div>
      <div className="form-r">
        <div className="form-g"><label>Véhicule *</label>
          <select value={str('vehicleCode')} onChange={(e) => set('vehicleCode', e.target.value)}>
            <option value="">— choisir —</option>
            {carList.map((v) => <option key={v.code} value={v.code}>{v.code} — {v.brand} {v.model}</option>)}
          </select>
        </div>
        <div className="form-g"><label>Structure *</label>
          <select value={str('structure')} onChange={(e) => {
            const v = e.target.value;
            setF((s) => {
              const cur = String(s.assigneeName ?? '');
              const auto = !cur || cur === org.managerFor(String(s.structure ?? ''));
              const code = org.codeFor(v);
              return {
                ...s, structure: v,
                assigneeName: auto ? org.managerFor(v) : s.assigneeName,
                businessUnit: code || s.businessUnit,
                costCenter: code && code !== s.businessUnit ? '' : s.costCenter,
              };
            });
          }}>
            <option value="">— choisir —</option>
            {withCurrentOrg(org.structures, f.structure).map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>
      <div className="form-r">
        <div className="form-g"><label>Attribuée à (responsable) *</label>
          <select value={str('assigneeName')} onChange={(e) => set('assigneeName', e.target.value)}>
            <option value="">— choisir —</option>
            {withCurrentOrg(org.managers, f.assigneeName).map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="form-g" />
      </div>
      <BuCcSelect
        bu={str('businessUnit') || null} cc={str('costCenter') || null}
        onChange={(bu, cc) => setF((s) => ({ ...s, businessUnit: bu ?? '', costCenter: cc ?? '' }))}
        buLabel="Business Unit" ccLabel="Centre de coût *" required noneLabel="— choisir —" />
      <div className="form-r">
        <div className="form-g"><label>Avec chauffeur dédié ? *</label>
          <select value={withDriver ? '1' : '0'} onChange={(e) => set('withDriver', e.target.value === '1')}>
            <option value="0">Non — la personne conduit elle-même</option>
            <option value="1">Oui — chauffeur dédié</option>
          </select>
        </div>
        <div className="form-g"><label>Chauffeur dédié {withDriver && <span style={{ color: 'var(--r5)' }}>*</span>}</label>
          <select value={str('driverCode')} disabled={!withDriver} onChange={(e) => set('driverCode', e.target.value)}>
            <option value="">— choisir —</option>
            {drivers.map((d) => <option key={d.code} value={d.code}>{d.code} — {d.name}</option>)}
          </select>
        </div>
      </div>
      <div className="form-r">
        <div className="form-g"><label>Date de début *</label><DateInput value={str('dateStart')} onChange={(e) => set('dateStart', e.target.value)} /></div>
        <div className="form-g"><label>Date de fin <span style={{ color: 'var(--tm)', fontWeight: 400 }}>— vide = toujours active</span></label><DateInput value={str('dateEnd')} onChange={(e) => set('dateEnd', e.target.value)} /></div>
      </div>
      <div className="form-r">
        <div className="form-g"><label>Trajet domicile (km / jour) *</label><input type="number" value={str('dailyHomeKm')} placeholder="ex. 30" onChange={(e) => set('dailyHomeKm', e.target.value)} /></div>
        <div className="form-g"><label>N° carte carburant <span style={{ color: 'var(--tm)', fontWeight: 400 }}>— optionnel</span></label><input value={str('fuelCardNumber')} onChange={(e) => set('fuelCardNumber', e.target.value)} /></div>
      </div>
      <div className="form-r">
        <div className="form-g"><label>Plafond carburant mensuel *</label>
          <select value={str('fuelCapMode')} onChange={(e) => set('fuelCapMode', e.target.value)}>
            <option value="">— choisir —</option>
            <option value="capped">Plafonné — montant mensuel défini</option>
            <option value="uncapped">Non plafonné</option>
          </select>
        </div>
        {capped
          ? <div className="form-g"><label>Montant du plafond (DA / mois) *</label>
              <input type="number" value={str('monthlyFuelCap')} placeholder="ex. 20 000" onChange={(e) => set('monthlyFuelCap', e.target.value)} /></div>
          : <div className="form-g" />}
      </div>
      <div className="form-g"><label>Note *</label><input value={str('note')} placeholder="Voiture de fonction" onChange={(e) => set('note', e.target.value)} /></div>
    </Modal>
  );
}
