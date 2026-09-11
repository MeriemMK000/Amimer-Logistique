'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import Tabs from '@/components/ui/Tabs';
import Modal from '@/components/ui/Modal';
import BaremeEditor from '@/components/parametres/BaremeEditor';
import {
  useBusinessUnits, useConfig, useConfirmedRemove, useCreate, useDrivers, useFuelEntries,
  useMaintenanceOrders, useMissions, useRemove, useSaveConfig, useSuppliers, useUpdate, useVehicles,
} from '@/lib/api/hooks';
import { runDataConsistencyCheck } from '@/lib/fleet/consistency';
import { PROPOSAL_WEIGHT_ROWS, PROPOSAL_DEFAULT, normalizeProposalConfig } from '@/lib/fleet/proposalConfig';
import {
  VEHICLE_LIST_DEFAULTS, VEHICLE_LIST_LABELS, normalizeVehicleLists, type VehicleLists,
} from '@/lib/reference/vehicleLists';
import { useSiteNames, normalizeSites } from '@/lib/reference/sites';
import CityInput from '@/components/ui/CityInput';
import type { BusinessUnit, CostCenter, EvalConfig, FuelPrices, Params, ProposalConfig, Supplier } from '@/lib/types';

const slug = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 4) || 'CC';

const DEFAULT_EVAL: EvalConfig = {
  scale: 20,
  criteria: [
    { key: 'conduite', label: 'Conduite', weight: 30 },
    { key: 'accidentologie', label: 'Accidentologie', weight: 25 },
    { key: 'assiduite', label: 'Assiduité', weight: 15 },
    { key: 'materiel', label: 'État du matériel affecté', weight: 15 },
    { key: 'discretion', label: 'Discrétion', weight: 10 },
    { key: 'presentation', label: 'Présentation', weight: 5 },
  ],
};

const plus = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;

const P_TABS = ['Général', 'Barème frais', 'Sélection automatique', 'Évaluation chauffeurs', 'Listes Flotte', 'Business Units', 'Fournisseurs', 'Cohérence'];
const TAB_SLUGS = ['general', 'bareme', 'selection', 'evaluation', 'listes', 'bu', 'fournisseurs', 'coherence'];

export default function ParametresPage() {
  return <Suspense fallback={<div className="page active" />}><ParametresInner /></Suspense>;
}

function ParametresInner() {
  const sp = useSearchParams();
  const [tab, setTab] = useState(() => Math.max(0, TAB_SLUGS.indexOf(sp.get('tab') ?? 'general')));
  const fuelCfg = useConfig<FuelPrices>('FUEL_PRICES');
  const paramCfg = useConfig<Params>('PARAMS');
  const evalCfg = useConfig<EvalConfig>('EVAL_CONFIG');
  const propCfg = useConfig<ProposalConfig>('PROPOSAL_CONFIG');
  const listsCfg = useConfig<VehicleLists>('VEHICLE_LISTS');
  const saveFuel = useSaveConfig('FUEL_PRICES');
  const saveParams = useSaveConfig('PARAMS');
  const saveEval = useSaveConfig('EVAL_CONFIG');
  const saveProp = useSaveConfig('PROPOSAL_CONFIG');
  const saveLists = useSaveConfig('VEHICLE_LISTS');
  const saveSites = useSaveConfig('SITES');
  // Sites / chantiers : liste éditée ici, proposée partout (mission, affectation, véhicule…).
  const effectiveSites = useSiteNames();
  const [sitesEdit, setSitesEdit] = useState<string | null>(null);
  const sitesText = sitesEdit ?? effectiveSites.join('\n');
  // Gestionnaires de cartes carburant : liste éditée ici, proposée dans « + Carte ».
  const cardMgrCfg = useConfig<string[]>('FUEL_CARD_MANAGERS');
  const saveCardMgr = useSaveConfig('FUEL_CARD_MANAGERS');
  const [cardMgrEdit, setCardMgrEdit] = useState<string | null>(null);
  const cardMgrText = cardMgrEdit ?? (Array.isArray(cardMgrCfg.data) ? cardMgrCfg.data.join('\n') : '');

  const [fp, setFp] = useState<FuelPrices>({ GASOIL: 0, ESSENCE: 0, GPL: 0, SP: 0, SUPER: 0 });
  const [pr, setPr] = useState<Params>({ reposMin: 30, vitMoy: 80, locAlertDef: 30, dailyAllowedKm: 3, joursOuvresMois: 22 });
  const [ev, setEv] = useState<EvalConfig>(DEFAULT_EVAL);
  const [pc, setPc] = useState<ProposalConfig>(PROPOSAL_DEFAULT);
  // Listes Flotte : on édite du TEXTE brut (une valeur par ligne) pour pouvoir sauter une ligne
  // librement ; le nettoyage (trim, doublons, valeurs canoniques) se fait à l'enregistrement.
  const vlToText = (v: VehicleLists): Record<keyof VehicleLists, string> =>
    ({ type: v.type.join('\n'), genre: v.genre.join('\n'), fuel: v.fuel.join('\n'), ownership: v.ownership.join('\n') });
  const [vlText, setVlText] = useState<Record<keyof VehicleLists, string>>(() => vlToText(VEHICLE_LIST_DEFAULTS));
  useEffect(() => { if (fuelCfg.data) setFp(fuelCfg.data); }, [fuelCfg.data]);
  useEffect(() => { if (paramCfg.data) setPr({ dailyAllowedKm: 3, ...paramCfg.data }); }, [paramCfg.data]);
  useEffect(() => { if (evalCfg.data?.criteria?.length) setEv(evalCfg.data); }, [evalCfg.data]);
  useEffect(() => { if (propCfg.data) setPc(normalizeProposalConfig(propCfg.data)); }, [propCfg.data]);
  useEffect(() => { if (listsCfg.data) setVlText(vlToText(normalizeVehicleLists(listsCfg.data))); }, [listsCfg.data]);
  const evalWeightTotal = ev.criteria.reduce((s, c) => s + (Number(c.weight) || 0), 0);

  const bus = useBusinessUnits();
  const createBU = useCreate<BusinessUnit>('business-units');
  const updateBU = useUpdate<BusinessUnit>('business-units');
  const removeBU = useRemove('business-units');

  const vehicles = useVehicles();
  const drivers = useDrivers();
  const missions = useMissions();
  const fuel = useFuelEntries();
  const maint = useMaintenanceOrders();
  const [check, setCheck] = useState<{ issues: string[]; warnings: string[] } | null>(null);

  const runCheck = () => {
    const r = runDataConsistencyCheck(vehicles.data ?? [], drivers.data ?? [], missions.data ?? [], fuel.data ?? [], maint.data ?? []);
    setCheck(r);
    toast.success(`Vérification terminée : ${r.issues.length} erreur(s), ${r.warnings.length} avertissement(s)`);
  };

  const [buEdit, setBuEdit] = useState<{ orig: string | null; code: string; name: string; managerName: string; managerEmail: string; ca: CostCenter[] } | null>(null);

  const openNewBU = () => setBuEdit({ orig: null, code: '', name: '', managerName: '', managerEmail: '', ca: [] });
  const openEditBU = (bu: BusinessUnit) => setBuEdit({
    orig: bu.code, code: bu.code, name: bu.name ?? '',
    managerName: bu.manager?.name ?? '', managerEmail: bu.manager?.email ?? '',
    ca: (bu.ca ?? []).map((c) => ({ ...c })),
  });

  const saveBU = async () => {
    if (!buEdit) return;
    const code = buEdit.code.trim().toUpperCase();
    const name = buEdit.name.trim();
    if (!code) { toast.error('Code obligatoire'); return; }
    if (!name) { toast.error('Nom obligatoire'); return; }
    const manager = (buEdit.managerName.trim() || buEdit.managerEmail.trim())
      ? { name: buEdit.managerName.trim() || undefined, email: buEdit.managerEmail.trim() || undefined }
      : null;
    const ca = buEdit.ca
      .map((c) => ({ code: c.code.trim() || `${code}-${slug(c.nom)}`, nom: c.nom.trim() }))
      .filter((c) => c.nom);
    try {
      if (buEdit.orig) await updateBU.mutateAsync({ id: buEdit.orig, body: { name, manager, ca } });
      else await createBU.mutateAsync({ code, name, manager, ca });
      toast.success(buEdit.orig ? `Structure ${code} mise à jour` : `Structure ${code} ajoutée`);
      setBuEdit(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur à l’enregistrement');
    }
  };

  return (
    <div className="page active">
      <Tabs tabs={P_TABS} active={tab} onChange={setTab} />

      {tab === 1 && <div className="cc" style={{ padding: 16, marginTop: 12 }}><BaremeEditor /></div>}

      {tab === 0 && (<>
      <div className="cr" style={{ marginTop: 12 }}>
        <div className="cc">
          <h3>Prix Carburant</h3>
          <div className="sub">Prix unitaires en DA/litre — l&apos;essence a deux qualités (sans plomb / super)</div>
          <div className="form-r3" style={{ marginTop: 14 }}>
            {([
              ['GASOIL', 'Gasoil'], ['SP', 'Essence sans plomb'], ['SUPER', 'Essence super'], ['GPL', 'GPL'],
            ] as [keyof FuelPrices, string][]).map(([k, label]) => (
              <div className="form-g" key={k}>
                <label>{label} (DA/L)</label>
                <input type="number" step="0.01" value={fp[k] ?? ""} onChange={(e) => setFp((s) => ({ ...s, [k]: Number(e.target.value), ...(k === 'SP' ? { ESSENCE: Number(e.target.value) } : {}) }))} />
              </div>
            ))}
          </div>
          <button className="btn btn-p btn-sm" style={{ marginTop: 10 }} onClick={() => saveFuel.mutateAsync(fp).then(() => toast.success('Prix carburant enregistrés'))}>Enregistrer les prix</button>
        </div>
        <div className="cc">
          <h3>Paramètres Missions</h3>
          <div className="sub">Délai repos entre étapes, vitesse moyenne GPS</div>
          <div style={{ marginTop: 14 }}>
            <div className="form-g"><label>Délai Repos entre Étapes (min)</label><input type="number" style={{ maxWidth: 120 }} value={pr.reposMin} onChange={(e) => setPr((s) => ({ ...s, reposMin: Number(e.target.value) }))} /></div>
            <div className="form-g"><label>Vitesse Moyenne GPS (km/h)</label><input type="number" style={{ maxWidth: 120 }} value={pr.vitMoy} onChange={(e) => setPr((s) => ({ ...s, vitMoy: Number(e.target.value) }))} /></div>
            <div className="form-g"><label>Défaut Alerte Location (jours)</label><input type="number" style={{ maxWidth: 120 }} value={pr.locAlertDef} onChange={(e) => setPr((s) => ({ ...s, locAlertDef: Number(e.target.value) }))} /></div>
            <div className="form-g"><label>Km quotidien autorisé (trajet domicile toléré / jour)</label><input type="number" style={{ maxWidth: 120 }} value={pr.dailyAllowedKm ?? 3} onChange={(e) => setPr((s) => ({ ...s, dailyAllowedKm: Number(e.target.value) }))} /></div>
            <div className="form-g"><label>Jours ouvrés / mois <span style={{ color: 'var(--tm)', fontWeight: 400 }}>— coût véhicule propre : mensuel ÷ ce nombre = coût/jour</span></label><input type="number" style={{ maxWidth: 120 }} value={pr.joursOuvresMois ?? 22} onChange={(e) => setPr((s) => ({ ...s, joursOuvresMois: Number(e.target.value) }))} /></div>
          </div>
          <button className="btn btn-p btn-sm" onClick={() => saveParams.mutateAsync(pr).then(() => toast.success('Paramètres enregistrés'))}>Enregistrer</button>
        </div>
      </div>
      </>)}

      {tab === 3 && (
      <div className="cr" style={{ marginTop: 12 }}>
        <div className="cc" style={{ gridColumn: '1/-1' }}>
          <h3>Évaluation des Chauffeurs</h3>
          <div className="sub">Échelle de notation et poids de chaque critère — entièrement paramétrable.</div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', margin: '12px 0', flexWrap: 'wrap' }}>
            <div className="form-g" style={{ marginBottom: 0 }}><label>Échelle</label>
              <select style={{ maxWidth: 120 }} value={ev.scale} onChange={(e) => setEv((s) => ({ ...s, scale: Number(e.target.value) }))}>
                <option value={20}>Sur 20</option><option value={5}>Sur 5</option>
              </select>
            </div>
            <div style={{ fontSize: '.75rem', color: evalWeightTotal === 100 ? 'var(--g6)' : 'var(--a6)' }}>
              Total des poids : <b>{evalWeightTotal}%</b>{evalWeightTotal !== 100 ? ' (recommandé : 100 %)' : ''}
            </div>
          </div>
          <div className="tw"><table>
            <thead><tr><th>Critère</th><th>Poids (%)</th></tr></thead>
            <tbody>
              {ev.criteria.map((c, i) => (
                <tr key={c.key}>
                  <td>{c.label}</td>
                  <td><input type="number" style={{ maxWidth: 90 }} value={c.weight}
                    onChange={(e) => setEv((s) => ({ ...s, criteria: s.criteria.map((x, j) => j === i ? { ...x, weight: Number(e.target.value) } : x) }))} /></td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn btn-p btn-sm" onClick={() => saveEval.mutateAsync(ev).then(() => toast.success('Configuration évaluation enregistrée'))}>Enregistrer</button>
            <button className="btn btn-o btn-sm" onClick={() => setEv(DEFAULT_EVAL)}>Réinitialiser (recommandé)</button>
          </div>
        </div>
      </div>
      )}

      {tab === 4 && (
      <div className="cr" style={{ marginTop: 12 }}>
        <div className="cc" style={{ gridColumn: '1/-1' }}>
          <h3>Listes Flotte — Type / Genre / Carburant / Propriété</h3>
          <div className="sub">
            Listes modifiables pour éviter les erreurs de saisie. <b>Une valeur par ligne</b> — appuie sur
            Entrée pour ajouter une ligne. Les valeurs de base (LEGER, LOURD, ENGIN, GASOIL, PROPRE…) sont
            toujours conservées ; tu peux en ajouter d&apos;autres. Elles alimentent les listes déroulantes du
            formulaire véhicule.
          </div>
          <div className="form-r3" style={{ marginTop: 12 }}>
            {(Object.keys(VEHICLE_LIST_DEFAULTS) as (keyof VehicleLists)[]).map((k) => (
              <div className="form-g" key={k}>
                <label>{VEHICLE_LIST_LABELS[k]}</label>
                <textarea rows={6} style={{ fontFamily: 'inherit', fontSize: '.78rem', resize: 'vertical' }}
                  value={vlText[k]}
                  onChange={(e) => setVlText((s) => ({ ...s, [k]: e.target.value }))} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn btn-p btn-sm" onClick={() => {
              const parsed = normalizeVehicleLists({
                type: vlText.type.split('\n'), genre: vlText.genre.split('\n'),
                fuel: vlText.fuel.split('\n'), ownership: vlText.ownership.split('\n'),
              });
              saveLists.mutateAsync(parsed).then(() => { setVlText(vlToText(parsed)); toast.success('Listes Flotte enregistrées'); });
            }}>Enregistrer</button>
            <button className="btn btn-o btn-sm" onClick={() => setVlText(vlToText(VEHICLE_LIST_DEFAULTS))}>Réinitialiser</button>
          </div>

          <div style={{ borderTop: '1px solid var(--bd)', marginTop: 16, paddingTop: 14 }}>
            <h3 style={{ fontSize: '.9rem' }}>Sites / Chantiers</h3>
            <div className="sub">
              La liste des sites/chantiers proposée <b>partout</b> (création de mission, affectation, fiche véhicule,
              carburant, chauffeur…). <b>Une valeur par ligne</b>. Aucune saisie libre dans les formulaires : pour
              ajouter un chantier, ajoute-le ici. Les sites déjà utilisés dans les données sont conservés automatiquement.
            </div>
            <div className="form-g" style={{ maxWidth: 360, marginTop: 10 }}>
              <label>Sites / Chantiers</label>
              <textarea rows={7} style={{ fontFamily: 'inherit', fontSize: '.78rem', resize: 'vertical' }}
                value={sitesText}
                onChange={(e) => setSitesEdit(e.target.value)}
                placeholder={'Hassi Messaoud\nGassi Touil\nSeddouk\n…'} />
            </div>
            <button className="btn btn-p btn-sm" onClick={() => {
              const parsed = normalizeSites(sitesText.split('\n'));
              saveSites.mutateAsync(parsed).then(() => { setSitesEdit(null); toast.success('Sites enregistrés'); });
            }}>Enregistrer les sites</button>
          </div>

          <div style={{ borderTop: '1px solid var(--bd)', marginTop: 16, paddingTop: 14 }}>
            <h3 style={{ fontSize: '.9rem' }}>Gestionnaires — cartes carburant</h3>
            <div className="sub">
              Liste des personnes pouvant être <b>gestionnaire d&apos;une carte carburant</b> (Carburant › Gestion des cartes › « + Carte »).
              <b> Une valeur par ligne</b>. Aucune saisie libre : pour ajouter un gestionnaire, ajoute-le ici.
            </div>
            <div className="form-g" style={{ maxWidth: 360, marginTop: 10 }}>
              <label>Gestionnaires</label>
              <textarea rows={5} style={{ fontFamily: 'inherit', fontSize: '.78rem', resize: 'vertical' }}
                value={cardMgrText}
                onChange={(e) => setCardMgrEdit(e.target.value)}
                placeholder={'M. Kaci\nMme Bensalem\nService Logistique\n…'} />
            </div>
            <button className="btn btn-p btn-sm" onClick={() => {
              const parsed = normalizeSites(cardMgrText.split('\n'));
              saveCardMgr.mutateAsync(parsed).then(() => { setCardMgrEdit(null); toast.success('Gestionnaires enregistrés'); });
            }}>Enregistrer les gestionnaires</button>
          </div>
        </div>
      </div>
      )}

      {tab === 2 && (
      <div className="cr" style={{ marginTop: 12 }}>
        <div className="cc" style={{ gridColumn: '1/-1' }}>
          <h3>Sélection automatique — véhicule &amp; chauffeur</h3>
          <div className="sub">
            Cœur de fonctionnement du système : poids de chaque variable de l&apos;algorithme
            qui propose le véhicule et le chauffeur des missions. Ces réglages s&apos;appliquent
            <b> à la fois</b> à la modale <i>Nouvelle mission</i> (bouton « Proposer ») et à
            l&apos;onglet <i>Planification › Sélection automatique</i>. Une variable décochée est ignorée (poids 0).
          </div>
          <div className="tw" style={{ marginTop: 12 }}><table>
            <thead><tr><th style={{ width: 40 }}>Actif</th><th>Variable</th><th>Cible</th><th style={{ width: 260 }}>Poids</th></tr></thead>
            <tbody>
              {PROPOSAL_WEIGHT_ROWS.map((r) => (
                <tr key={r.key} style={{ opacity: pc.enabled[r.key] === false ? 0.45 : 1 }}>
                  <td style={{ textAlign: 'center' }}>
                    <input type="checkbox" checked={pc.enabled[r.key] !== false}
                      onChange={(e) => setPc((s) => ({ ...s, enabled: { ...s.enabled, [r.key]: e.target.checked } }))} />
                  </td>
                  <td><b>{r.label}</b><div style={{ fontSize: '.68rem', color: 'var(--tm)' }}>{r.hint}</div></td>
                  <td style={{ fontSize: '.7rem', color: 'var(--tm)' }}>{r.scope === 'vehicule' ? 'Véhicule' : 'Chauffeur'}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="range" min={0} max={50} style={{ flex: 1 }}
                        value={pc.weights[r.key] ?? 0} disabled={pc.enabled[r.key] === false}
                        onChange={(e) => setPc((s) => ({ ...s, weights: { ...s.weights, [r.key]: Number(e.target.value) } }))} />
                      <input type="number" min={0} max={50} style={{ width: 56 }}
                        value={pc.weights[r.key] ?? 0} disabled={pc.enabled[r.key] === false}
                        onChange={(e) => setPc((s) => ({ ...s, weights: { ...s.weights, [r.key]: Number(e.target.value) } }))} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="btn btn-p btn-sm" onClick={() => saveProp.mutateAsync(pc).then(() => toast.success('Réglages de sélection automatique enregistrés'))}>Enregistrer</button>
            <button className="btn btn-o btn-sm" onClick={() => setPc(PROPOSAL_DEFAULT)}>Réinitialiser (recommandé)</button>
          </div>
        </div>
      </div>
      )}

      {tab === 6 && <SuppliersTab />}

      {tab === 7 && (
      <div className="cr" style={{ marginTop: 12 }}>
        <div className="cc" style={{ gridColumn: '1/-1' }}>
          <h3>Vérification Cohérence des Données</h3>
          <div className="sub">Contrôler la cohérence entre véhicules, chauffeurs, missions, carburant et maintenance</div>
          <button className="btn btn-p btn-sm" style={{ marginTop: 10 }} onClick={runCheck}>Lancer la vérification</button>
          {check && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                <div style={{ padding: '8px 14px', borderRadius: 'var(--rs)', background: 'var(--b0)', fontSize: '.72rem' }}>
                  <strong>{vehicles.data?.length ?? 0}</strong> véhicules · <strong>{drivers.data?.length ?? 0}</strong> chauffeurs · <strong>{missions.data?.length ?? 0}</strong> missions · <strong>{fuel.data?.length ?? 0}</strong> pleins
                </div>
                {check.issues.length > 0 && <div style={{ padding: '8px 14px', borderRadius: 'var(--rs)', background: 'var(--r1)', color: 'var(--r6)', fontSize: '.72rem', fontWeight: 600 }}>{check.issues.length} erreur(s)</div>}
                {check.warnings.length > 0 && <div style={{ padding: '8px 14px', borderRadius: 'var(--rs)', background: 'var(--a1)', color: 'var(--a6)', fontSize: '.72rem', fontWeight: 600 }}>{check.warnings.length} avertissement(s)</div>}
                {!check.issues.length && !check.warnings.length && <div style={{ padding: '8px 14px', borderRadius: 'var(--rs)', background: 'var(--g1)', color: 'var(--g6)', fontSize: '.72rem', fontWeight: 600 }}>Tout est OK</div>}
              </div>
              {check.issues.map((i, k) => <div key={k} style={{ fontSize: '.72rem', padding: '4px 8px', borderLeft: '3px solid var(--r5)', marginBottom: 3, background: 'var(--r0)' }}>{i}</div>)}
              {check.warnings.map((w, k) => <div key={k} style={{ fontSize: '.72rem', padding: '4px 8px', borderLeft: '3px solid var(--a5)', marginBottom: 3, background: 'var(--a0)' }}>{w}</div>)}
            </div>
          )}
        </div>
      </div>
      )}

      {tab === 5 && (
      <div className="tc" style={{ marginTop: 12 }}>
        <div className="th">
          <div><h3>Business Units &amp; structures</h3><div className="sub">Organigramme Amimer — chaque structure a un responsable et ses centres de coût. Sert à la refacturation (BU + centre de coût partout).</div></div>
          <div><button className="btn btn-p btn-sm" onClick={openNewBU}>{plus} Nouvelle structure</button></div>
        </div>
        <div style={{ padding: 14 }}>
          <div className="buca-tree">
            {[...(bus.data ?? [])].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'fr')).map((bu) => (
              <div className="buca-bu" key={bu.code}>
                <div className="buca-bu-hd">
                  <div>
                    <span className="buca-code">{bu.code}</span> {bu.name}
                    <span style={{ color: 'var(--tm)', fontWeight: 400, marginLeft: 8, fontSize: '.72rem' }}>
                      {bu.manager?.name
                        ? <>· {bu.manager.name}{bu.manager.email ? ` (${bu.manager.email})` : ''}</>
                        : <>· <span style={{ color: 'var(--a6)' }}>responsable non attribué</span></>}
                      {(bu.ca?.length ?? 0) > 0 && ` · ${bu.ca!.length} centre(s) de coût`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-o btn-sm" onClick={() => openEditBU(bu)}>Modifier</button>
                    <button className="btn btn-r btn-sm" onClick={() => { if (confirm(`Supprimer la structure ${bu.code} ?`)) removeBU.mutateAsync(bu.code).then(() => toast.success('Structure supprimée')).catch((e) => toast.error(e instanceof Error ? e.message : 'Suppression impossible')); }}>✕</button>
                  </div>
                </div>
                {(bu.ca ?? []).map((ca) => (
                  <div className="buca-ca" key={ca.code}>
                    <span className="buca-code">{ca.code}</span> {ca.nom}
                  </div>
                ))}
              </div>
            ))}
            {!bus.data?.length && <p style={{ fontSize: '.78rem', color: 'var(--tm)' }}>Aucune structure définie</p>}
          </div>
        </div>
      </div>
      )}

      {buEdit && (
        <Modal open onClose={() => setBuEdit(null)} title={buEdit.orig ? `Structure ${buEdit.orig}` : 'Nouvelle structure'} wide
          footer={<><button className="btn btn-o" onClick={() => setBuEdit(null)}>Annuler</button><button className="btn btn-p" onClick={saveBU} disabled={createBU.isPending || updateBU.isPending}>Enregistrer</button></>}>
          <div className="form-r">
            <div className="form-g"><label>Code {buEdit.orig ? '' : '*'}</label>
              <input value={buEdit.code} readOnly={!!buEdit.orig} maxLength={6}
                onChange={(e) => setBuEdit({ ...buEdit, code: e.target.value.toUpperCase() })} placeholder="ex. RH, LOG, PWT" />
            </div>
            <div className="form-g"><label>Nom de la structure *</label>
              <input value={buEdit.name} onChange={(e) => setBuEdit({ ...buEdit, name: e.target.value })} placeholder="ex. Ressources Humaines" />
            </div>
          </div>
          <div className="form-r">
            <div className="form-g"><label>Responsable — nom</label>
              <input value={buEdit.managerName} onChange={(e) => setBuEdit({ ...buEdit, managerName: e.target.value })} placeholder="ex. BRAHMI Ibtissem" />
            </div>
            <div className="form-g"><label>Responsable — e-mail</label>
              <input type="email" value={buEdit.managerEmail} onChange={(e) => setBuEdit({ ...buEdit, managerEmail: e.target.value })} placeholder="ex. ibtissembrahmi@amimer.com" />
            </div>
          </div>
          <div className="form-g">
            <label>Centres de coût</label>
            {buEdit.ca.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                <input value={c.code} onChange={(e) => { const ca = [...buEdit.ca]; ca[i] = { ...ca[i], code: e.target.value.toUpperCase() }; setBuEdit({ ...buEdit, ca }); }} placeholder="Code (auto)" style={{ flex: 1 }} />
                <input value={c.nom} onChange={(e) => { const ca = [...buEdit.ca]; ca[i] = { ...ca[i], nom: e.target.value }; setBuEdit({ ...buEdit, ca }); }} placeholder="Nom du centre de coût" style={{ flex: 2 }} />
                <button className="btn btn-r btn-sm" onClick={() => setBuEdit({ ...buEdit, ca: buEdit.ca.filter((_, j) => j !== i) })}>✕</button>
              </div>
            ))}
            <button className="btn btn-o btn-sm" onClick={() => setBuEdit({ ...buEdit, ca: [...buEdit.ca, { code: '', nom: '' }] })}>+ Centre de coût</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─── Fournisseurs (garages, agents de marque, ateliers) ─── */
type SupplierForm = { code: string; name: string; contact: string; phone: string; email: string; city: string };
const emptySupplier: SupplierForm = { code: '', name: '', contact: '', phone: '', email: '', city: '' };

function SuppliersTab() {
  const list = useSuppliers();
  const create = useCreate<Supplier>('suppliers');
  const update = useUpdate<Supplier>('suppliers');
  const remove = useConfirmedRemove('suppliers', 'ce fournisseur');
  const [edit, setEdit] = useState<SupplierForm | null>(null);

  const rows = (list.data ?? []) as Supplier[];
  const isNew = edit != null && !rows.some((s) => s.code === edit.code);

  const nextCode = () => {
    const max = rows.reduce((m, s) => {
      const n = parseInt(String(s.code).replace(/\D/g, ''), 10);
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);
    return `FRN-${String(max + 1).padStart(3, '0')}`;
  };

  const openNew = () => setEdit({ ...emptySupplier, code: nextCode() });
  const openEdit = (s: Supplier) => setEdit({
    code: s.code, name: s.name ?? '', contact: s.contact ?? '',
    phone: s.phone ?? '', email: s.email ?? '', city: s.city ?? '',
  });

  const save = async () => {
    if (!edit) return;
    if (!edit.name.trim()) { toast.error('La raison sociale est obligatoire'); return; }
    const body = {
      name: edit.name.trim(), contact: edit.contact.trim() || null,
      phone: edit.phone.trim() || null, email: edit.email.trim() || null, city: edit.city.trim() || null,
    };
    try {
      if (isNew) await create.mutateAsync({ code: edit.code, ...body });
      else await update.mutateAsync({ id: edit.code, body });
      toast.success(isNew ? `Fournisseur ${edit.code} ajouté` : `${edit.code} mis à jour`);
      setEdit(null);
    } catch (e) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erreur');
    }
  };

  return (
    <div className="tc" style={{ marginTop: 12 }}>
      <div className="th">
        <div>
          <h3>Fournisseurs</h3>
          <div className="sub">
            Garages, agents de marque, ateliers poids lourd… Utilisés dans les <b>ordres de travail</b>
            {' '}(Maintenance) et les <b>bons de commande</b> de pièces.
          </div>
        </div>
        <div><button className="btn btn-p btn-sm" onClick={openNew}>{plus} Ajouter fournisseur</button></div>
      </div>
      <div className="tw" style={{ padding: 14 }}>
        <table>
          <thead><tr><th>Code</th><th>Raison sociale</th><th>Contact</th><th>Téléphone</th><th>Email</th><th>Ville</th><th /></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.code} className="clickable" onClick={() => openEdit(s)}>
                <td style={{ fontWeight: 600 }}>{s.code}</td>
                <td>{s.name ?? '—'}</td>
                <td>{s.contact ?? '—'}</td>
                <td>{s.phone ?? '—'}</td>
                <td>{s.email ?? '—'}</td>
                <td>{s.city ?? '—'}</td>
                <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                  <button className="btn btn-o btn-sm" onClick={() => openEdit(s)}>Modifier</button>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--tm)', padding: 16 }}>Aucun fournisseur — clique sur « Ajouter fournisseur ».</td></tr>}
          </tbody>
        </table>
      </div>

      {edit && (
        <Modal open onClose={() => setEdit(null)} title={isNew ? 'Nouveau fournisseur' : `Fournisseur ${edit.code}`}
          footer={<>
            {!isNew && (
              <button className="btn btn-r" style={{ marginRight: 'auto' }}
                onClick={async () => { await remove(edit.code, edit.name || edit.code); setEdit(null); }}>
                Supprimer
              </button>
            )}
            <button className="btn btn-o" onClick={() => setEdit(null)}>Annuler</button>
            <button className="btn btn-p" onClick={save} disabled={create.isPending || update.isPending}>
              {isNew ? 'Enregistrer' : 'Mettre à jour'}
            </button>
          </>}>
          <div className="form-r">
            <div className="form-g"><label>Code</label><input value={edit.code} readOnly /></div>
            <div className="form-g"><label>Raison sociale <span style={{ color: 'var(--r5)' }}>*</span></label>
              <input value={edit.name} placeholder="ex. Falcon Motors (agent Fiat / Iveco)" onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
          </div>
          <div className="form-r">
            <div className="form-g"><label>Contact</label><input value={edit.contact} placeholder="ex. M. Larbi" onChange={(e) => setEdit({ ...edit, contact: e.target.value })} /></div>
            <div className="form-g"><label>Téléphone</label><input value={edit.phone} placeholder="021 55 10 10" onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></div>
          </div>
          <div className="form-r">
            <div className="form-g"><label>Email</label><input type="email" value={edit.email} placeholder="contact@fournisseur.dz" onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></div>
            <div className="form-g"><label>Ville</label><CityInput value={edit.city} onChange={(v) => setEdit({ ...edit, city: v })} placeholder="Commune, rue ou adresse…" /></div>
          </div>
          {!isNew && (
            <div style={{ fontSize: '.7rem', color: 'var(--tm)' }}>
              Un fournisseur rattaché à un ordre de travail ou un bon de commande ne peut pas être supprimé.
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
