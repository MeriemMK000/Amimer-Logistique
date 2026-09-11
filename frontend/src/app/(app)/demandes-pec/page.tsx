'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  useBusinessUnits, useConfirmedRemove, useCreate, useDpcRequests, useImportDpc,
  useUpdate, useValidateDpc,
} from '@/lib/api/hooks';
import KpiTile from '@/components/ui/KpiTile';
import Modal from '@/components/ui/Modal';
import BuCcSelect from '@/components/ui/BuCcSelect';
import PlaceInput from '@/components/ui/PlaceInput';
import Tabs from '@/components/ui/Tabs';
import DateInput from '@/components/ui/DateInput';
import { fd, fk } from '@/lib/fleet/format';
import type { BusinessUnit, DpcRequest } from '@/lib/types';

const plus = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 14, height: 14 }}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
const PRIORITE_COLOR: Record<string, string> = { URGENTE: 'bg-r', HAUTE: 'bg-a', NORMALE: 'bg-t', BASSE: 'bg-b' };
const STATUT_LABEL: Record<string, string> = { EN_ATTENTE: 'En Attente', VALIDEE: 'Validée', TRANSFORMEE: 'Transformée', REJETEE: 'Rejetée' };
const STATUT_COLOR: Record<string, string> = { EN_ATTENTE: 'bg-a', VALIDEE: 'bg-g', TRANSFORMEE: 'bg-t', REJETEE: 'bg-r' };
const SOURCE_LABEL: Record<string, string> = { interne: 'Interne', formulaire: 'Formulaire', amimer_energie: 'Amimer Én.' };
const SOURCE_COLOR: Record<string, string> = { interne: 'bg-b', formulaire: 'bg-a', amimer_energie: 'bg-g' };

export default function DemandesPecPage() {
  const [tab, setTab] = useState(0);
  return (
    <div className="page active">
      <Tabs tabs={['Demandes de prise en charge', 'Réception (formulaire + Amimer Énergie)']} active={tab} onChange={setTab} />
      {tab === 0 ? <DpcQueueTab /> : <ReceptionTab />}
    </div>
  );
}

/* ─── File unique : toutes les demandes de prise en charge, quelle que soit la source ─── */
function DpcQueueTab() {
  const router = useRouter();
  const dpc = useDpcRequests();
  const bus = useBusinessUnits();
  const buLabel = (raw: string | null | undefined) => {
    const s = (raw ?? '').trim();
    if (!s) return '—';
    const hit = (bus.data ?? []).find((x) => x.code === s || x.name.toLowerCase() === s.toLowerCase());
    return hit ? hit.name : s;
  };
  // Structure = centre de coût de la BU (référentiel) — on affiche son libellé, pas le code.
  const strucLabel = (buRaw: string | null | undefined, cc: string | null | undefined) => {
    const s = (cc ?? '').trim();
    if (!s) return '';
    const bu = (bus.data ?? []).find((x) => x.code === (buRaw ?? '').trim() || x.name.toLowerCase() === (buRaw ?? '').trim().toLowerCase());
    const hit = (bu?.ca ?? []).find((c) => c.code === s || c.nom.toLowerCase() === s.toLowerCase());
    return hit ? hit.nom : s;
  };
  const createDpc = useCreate<DpcRequest>('dpc-requests');
  const updateDpc = useUpdate<DpcRequest>('dpc-requests');
  const validateDpc = useValidateDpc();
  const removeDpc = useConfirmedRemove('dpc-requests', 'la demande');

  const [statut, setStatut] = useState('all');
  const [src, setSrc] = useState('all');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<DpcRequest | null | undefined>(undefined);

  const DPC = (dpc.data ?? []) as (DpcRequest & { source?: string; organisation?: string; demandeurTel?: string; pax?: number; distanceKm?: number })[];
  const list = useMemo(() => {
    let l = DPC.slice().sort((a, b) => (b.dateSaisie ?? '').localeCompare(a.dateSaisie ?? ''));
    // Une demande transformée en mission sort de la file (retour DG) — visible seulement si on filtre dessus.
    if (statut !== 'all') l = l.filter((d) => d.statut === statut);
    else l = l.filter((d) => d.statut !== 'TRANSFORMEE');
    if (src !== 'all') l = l.filter((d) => (d.source ?? 'interne') === src);
    if (search) {
      const s = search.toLowerCase();
      l = l.filter((d) => `${d.code}${d.depAller}${d.destAller}${d.bu}${d.structure}${d.demandeur}${d.organisation}${d.notes}`.toLowerCase().includes(s));
    }
    return l;
  }, [DPC, statut, src, search]);

  const k = {
    total: DPC.length,
    enAtt: DPC.filter((d) => d.statut === 'EN_ATTENTE').length,
    validees: DPC.filter((d) => d.statut === 'VALIDEE').length,
    transformees: DPC.filter((d) => d.statut === 'TRANSFORMEE').length,
    urgentes: DPC.filter((d) => (d.urgence === 'URGENTE' || d.priorite === 'URGENTE') && d.statut === 'EN_ATTENTE').length,
  };

  const setStatutOf = async (d: DpcRequest, newS: string) => {
    if (newS === 'VALIDEE') await validateDpc.mutateAsync(d.code);
    else await updateDpc.mutateAsync({ id: d.code, body: { statut: newS } });
    toast.success(`Demande ${d.code} → ${STATUT_LABEL[newS] ?? newS}`);
  };
  // Pas de mission « fantôme » : on ouvre le formulaire pré-rempli (véhicule + chauffeur obligatoires).
  const transform = (d: DpcRequest) => router.push(`/missions?dpc=${encodeURIComponent(d.code)}`);

  return (
    <div className="page active">
      <div className="fb" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={statut} onChange={(e) => setStatut(e.target.value)} style={selStyle}>
            <option value="all">Tous les statuts</option>
            {['EN_ATTENTE', 'VALIDEE', 'TRANSFORMEE', 'REJETEE'].map((s) => <option key={s} value={s}>{STATUT_LABEL[s]}</option>)}
          </select>
          <select value={src} onChange={(e) => setSrc(e.target.value)} style={selStyle}>
            <option value="all">Toutes les sources</option>
            {['interne', 'formulaire', 'amimer_energie'].map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}
          </select>
          <input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...selStyle, width: 180 }} />
        </div>
        <button className="btn btn-p btn-sm" onClick={() => setForm(null)}>{plus} Nouvelle Demande</button>
      </div>

      <div className="rap-kpi-row">
        <KpiTile label="Total Demandes" value={k.total} cls="kpi-b" />
        <KpiTile label="En Attente" value={k.enAtt} sub="à valider" cls="kpi-a" />
        <KpiTile label="Validées" value={k.validees} sub="prêtes → mission" cls="kpi-g" />
        <KpiTile label="Transformées" value={k.transformees} sub="en mission" cls="kpi-t" />
        <KpiTile label="Urgentes" value={k.urgentes} sub="en attente" cls="kpi-r" />
      </div>

      <div className="tc" style={{ marginTop: 12 }}>
        <div className="tw">
          <table>
            <thead><tr><th>Code</th><th>Source</th><th>Trajet</th><th>BU / Structure</th><th>Prio.</th><th>Statut</th><th>Demandeur</th><th style={{ textAlign: 'center' }}>Actions</th></tr></thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.code}>
                  <td style={{ fontWeight: 600 }}>{d.code}<div style={{ fontSize: '.6rem', color: 'var(--tm)', fontWeight: 400 }}>saisie {fd(d.dateSaisie)}</div></td>
                  <td><span className={`bg ${SOURCE_COLOR[d.source ?? 'interne'] ?? 'bg-t'}`} style={{ fontSize: '.55rem' }}>{SOURCE_LABEL[d.source ?? 'interne'] ?? d.source}</span></td>
                  <td style={{ fontSize: '.72rem' }} title={`${d.depAller} → ${d.destAller}${d.distanceKm ? ` · ${fk(d.distanceKm)} km` : ''}`}>
                    {d.depAller} → <b>{d.destAller}</b>
                    <div style={{ fontSize: '.6rem', color: 'var(--tm)' }}>{d.dateAller}{d.dateRetour ? ` → ${d.dateRetour}` : ''}{d.pax ? ` · ${d.pax} pax` : ''}{(d as { tonnage?: number }).tonnage ? ` · ${(d as { tonnage?: number }).tonnage} t` : ''}</div>
                  </td>
                  <td style={{ fontSize: '.72rem', maxWidth: 170 }} title={strucLabel(d.bu, d.structure)}>{buLabel(d.bu)}<div style={{ fontSize: '.62rem', color: 'var(--tm)' }}>{strucLabel(d.bu, d.structure)}</div></td>
                  <td style={{ whiteSpace: 'nowrap' }}><span className={`bg ${PRIORITE_COLOR[d.priorite ?? ''] ?? 'bg-t'}`} style={{ fontSize: '.55rem' }}>{d.priorite}</span></td>
                  <td><span className={`bg ${STATUT_COLOR[d.statut] ?? 'bg-t'}`} style={{ fontSize: '.58rem' }}>{STATUT_LABEL[d.statut] ?? d.statut}</span></td>
                  <td style={{ fontSize: '.72rem', maxWidth: 140 }} title={`${d.demandeur ?? ''}${d.organisation ? ` — ${d.organisation}` : ''}${d.demandeurTel ? ` — ${d.demandeurTel}` : ''}`}>{d.demandeur}<div style={{ fontSize: '.6rem', color: 'var(--tm)' }}>{d.organisation ?? d.demandeurTel ?? ''}</div></td>
                  <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <button className="btn btn-sm" style={{ fontSize: '.6rem', padding: '2px 6px' }} onClick={() => setForm(d)}>Modifier</button>{' '}
                    {d.statut === 'EN_ATTENTE' && (
                      <>
                        <button className="btn btn-sm btn-p" style={{ fontSize: '.6rem', padding: '2px 6px' }} onClick={() => setStatutOf(d, 'VALIDEE')}>Valider ✓</button>{' '}
                        <button className="btn btn-sm" style={{ fontSize: '.6rem', padding: '2px 6px', color: 'var(--r5)' }} onClick={() => setStatutOf(d, 'REJETEE')}>✕</button>
                      </>
                    )}
                    {d.statut === 'VALIDEE' && <button className="btn btn-sm btn-p" style={{ fontSize: '.6rem', padding: '2px 6px' }} onClick={() => transform(d)}>→ Mission</button>}
                    {d.statut === 'TRANSFORMEE' && d.missionRef && <span style={{ fontSize: '.6rem', color: 'var(--b5)' }}>{d.missionRef}</span>}{' '}
                    {(d.statut === 'REJETEE' || d.statut === 'TRANSFORMEE') && <button className="btn btn-sm btn-r" style={{ fontSize: '.6rem', padding: '2px 6px' }} onClick={() => removeDpc(d.code)}>Suppr.</button>}
                  </td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--tm)' }}>Aucune demande</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {form !== undefined && (
        <DpcFormModal
          dpc={form} businessUnits={bus.data ?? []}
          onClose={() => setForm(undefined)}
          onCreate={async (body) => { await createDpc.mutateAsync(body); toast.success('Demande créée'); }}
          onUpdate={async (code, body) => { await updateDpc.mutateAsync({ id: code, body }); toast.success(`Demande ${code} mise à jour`); }}
          nextCode={`DPC-${new Date().getFullYear()}-${String(DPC.length + 1).padStart(4, '0')}`}
        />
      )}
    </div>
  );
}

/* ─── Réception : le formulaire public + l'import de la plateforme Amimer Énergie ─── */
function ReceptionTab() {
  const dpc = useDpcRequests();
  const importDpc = useImportDpc();
  const [csv, setCsv] = useState('');
  const [copied, setCopied] = useState(false);
  const publicLink = typeof window !== 'undefined' ? `${window.location.origin}/demande-pec` : '/demande-pec';
  const rows = (dpc.data ?? []) as (DpcRequest & { source?: string })[];
  const bySrc = (s: string) => rows.filter((r) => (r.source ?? 'interne') === s);

  const copy = async () => {
    try { await navigator.clipboard.writeText(publicLink); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  return (
    <div className="page active">
      <div className="cr">
        <div className="cc">
          <h3>1 · Formulaire public — n&apos;importe qui renseigne et envoie</h3>
          <div className="sub">Lien à diffuser (aucun compte requis). Les demandes entrent directement dans la file en « En attente ».</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
            <a href={publicLink} target="_blank" rel="noreferrer" className="btn btn-o btn-sm">Ouvrir le formulaire ↗</a>
            <button className="btn btn-o btn-sm" onClick={copy}>{copied ? '✓ Copié' : 'Copier le lien'}</button>
            <code style={{ fontSize: '.72rem', color: 'var(--tm)', wordBreak: 'break-all' }}>{publicLink}</code>
          </div>
          <div style={{ marginTop: 12, fontSize: '.78rem', color: 'var(--tm)' }}>
            Reçues via formulaire : <b>{bySrc('formulaire').length}</b> · dont en attente : <b>{bySrc('formulaire').filter((r) => r.statut === 'EN_ATTENTE').length}</b>
          </div>
        </div>

        <div className="cc">
          <h3>2 · Plateforme Amimer Énergie — récupération des demandes validées</h3>
          <div className="sub">Import des demandes déjà validées côté Amimer Énergie. Elles entrent en « Validée », prêtes à devenir des missions.</div>
          <div style={{ fontSize: '.72rem', color: 'var(--tm)', margin: '8px 0 4px' }}>
            Colonnes CSV : <code>refExterne, requesterName, fromLoc, toLoc, dateAller, dateRetour, pax, organisation, structure, bu</code>
          </div>
          <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={4}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: '.72rem' }}
            placeholder={'refExterne,requesterName,fromLoc,toLoc,dateAller,pax,structure\nAE-4821,Direction SI,Alger,Hassi Messaoud,2026-09-20,3,Équipe informatique'} />
          <button className="btn btn-p btn-sm" style={{ marginTop: 6 }} disabled={!csv.trim() || importDpc.isPending}
            onClick={async () => { const r = await importDpc.mutateAsync(csv); toast.success(`${r.imported} demande(s) importée(s) : ${r.codes.join(', ')}`); setCsv(''); }}>
            Importer dans la file
          </button>
          <div style={{ marginTop: 12, fontSize: '.78rem', color: 'var(--tm)' }}>
            Importées Amimer Énergie : <b>{bySrc('amimer_energie').length}</b> · validées non transformées : <b>{bySrc('amimer_energie').filter((r) => r.statut === 'VALIDEE').length}</b>
          </div>
        </div>
      </div>

      <div className="cc" style={{ marginTop: 12 }}>
        <h3>Dernières réceptions</h3>
        <div className="tw" style={{ marginTop: 8 }}>
          <table>
            <thead><tr><th>Code</th><th>Source</th><th>Reçue le</th><th>Trajet</th><th>Demandeur</th><th>Statut</th></tr></thead>
            <tbody>
              {rows.filter((r) => (r.source ?? 'interne') !== 'interne' && r.statut !== 'TRANSFORMEE').sort((a, b) => (b.dateSaisie ?? '').localeCompare(a.dateSaisie ?? '')).slice(0, 12).map((d) => (
                <tr key={d.code}>
                  <td style={{ fontWeight: 600 }}>{d.code}</td>
                  <td><span className={`bg ${SOURCE_COLOR[d.source ?? 'interne']}`} style={{ fontSize: '.55rem' }}>{SOURCE_LABEL[d.source ?? 'interne']}</span></td>
                  <td style={{ fontSize: '.72rem' }}>{fd(d.dateSaisie)}</td>
                  <td style={{ fontSize: '.72rem' }}>{d.depAller} → {d.destAller}</td>
                  <td style={{ fontSize: '.72rem' }}>{d.demandeur}</td>
                  <td><span className={`bg ${STATUT_COLOR[d.statut] ?? 'bg-t'}`} style={{ fontSize: '.58rem' }}>{STATUT_LABEL[d.statut] ?? d.statut}</span></td>
                </tr>
              ))}
              {!rows.some((r) => (r.source ?? 'interne') !== 'interne') && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--tm)', padding: 14 }}>Aucune demande reçue via formulaire ou plateforme</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const selStyle: React.CSSProperties = { padding: '6px 10px', border: '1px solid var(--bd)', borderRadius: 'var(--rs)', fontSize: '.78rem', background: 'var(--s1)', color: 'var(--tp)' };

function DpcFormModal({ dpc, businessUnits, onClose, onCreate, onUpdate, nextCode }: {
  dpc: DpcRequest | null;
  businessUnits: BusinessUnit[];
  onClose: () => void;
  onCreate: (b: Partial<DpcRequest>) => Promise<void>;
  onUpdate: (code: string, b: Partial<DpcRequest>) => Promise<void>;
  nextCode: string;
}) {
  const isEdit = !!dpc;
  const [f, setF] = useState<Partial<DpcRequest>>(dpc ?? {
    depAller: 'Alger', priorite: 'NORMALE', urgence: 'NORMALE', bu: businessUnits[0]?.code ?? '',
  });
  const set = (k: keyof DpcRequest) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = async () => {
    {
      const miss = [!f.depAller?.trim() && 'départ', !f.destAller?.trim() && 'destination', !f.dateAller && 'date aller', !f.bu && 'BU', !f.structure?.trim() && 'structure'].filter(Boolean);
      if (miss.length) { toast.error(`Champs obligatoires : ${miss.join(', ')}`); return; }
    }
    const body: Partial<DpcRequest> = {
      ...f,
      depRetour: f.depRetour || f.destAller,
      destRetour: f.destRetour || f.depAller,
      pax: f.pax != null && `${f.pax}` !== '' ? Number(f.pax) : null,
      tonnage: f.tonnage != null && `${f.tonnage}` !== '' ? Number(f.tonnage) : null,
    };
    if (isEdit) await onUpdate(dpc!.code, body);
    else await onCreate({ ...body, code: nextCode, dateSaisie: new Date().toISOString().slice(0, 10), statut: 'EN_ATTENTE' });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={`${isEdit ? 'Modifier' : 'Nouvelle'} demande de prise en charge`}
      footer={<><button className="btn btn-o" onClick={onClose}>Annuler</button><button className="btn btn-p" onClick={submit}>Enregistrer</button></>}>
      {isEdit && (dpc as { source?: string })?.source && (dpc as { source?: string }).source !== 'interne' && (
        <div style={{ fontSize: '.74rem', color: 'var(--tm)', marginBottom: 10, padding: '6px 10px', background: 'var(--s0)', borderRadius: 'var(--rs)' }}>
          Source : <b>{SOURCE_LABEL[(dpc as { source?: string }).source ?? ''] ?? (dpc as { source?: string }).source}</b>
          {(dpc as { demandeurTel?: string }).demandeurTel ? ` · ${(dpc as { demandeurTel?: string }).demandeurTel}` : ''}
          {(dpc as { demandeurEmail?: string }).demandeurEmail ? ` · ${(dpc as { demandeurEmail?: string }).demandeurEmail}` : ''}
          {(dpc as { organisation?: string }).organisation ? ` · ${(dpc as { organisation?: string }).organisation}` : ''}
          {(dpc as { refExterne?: string }).refExterne ? ` · réf. externe ${(dpc as { refExterne?: string }).refExterne}` : ''}
        </div>
      )}
      <div className="form-r">
        <div className="form-g"><label>Date Aller *</label><DateInput value={f.dateAller ?? ''} onChange={set('dateAller')} /></div>
        <div className="form-g"><label>Date Retour</label><DateInput value={f.dateRetour ?? ''} onChange={set('dateRetour')} /></div>
      </div>
      <div className="form-r">
        <div className="form-g"><label>Départ Aller</label>
          <PlaceInput value={f.depAller ?? ''} onChange={(v) => setF((s) => ({ ...s, depAller: v }))} placeholder="Commune, rue ou adresse précise…" />
        </div>
        <div className="form-g"><label>Destination Aller *</label>
          <PlaceInput value={f.destAller ?? ''} onChange={(v) => setF((s) => ({ ...s, destAller: v }))} placeholder="Commune, rue ou adresse précise…" />
        </div>
      </div>
      <div className="form-r">
        <div className="form-g"><label>Départ Retour</label>
          <PlaceInput value={f.depRetour ?? ''} onChange={(v) => setF((s) => ({ ...s, depRetour: v }))} placeholder="— comme destination aller —" />
        </div>
        <div className="form-g"><label>Destination Retour</label>
          <PlaceInput value={f.destRetour ?? ''} onChange={(v) => setF((s) => ({ ...s, destRetour: v }))} placeholder="— comme départ aller —" />
        </div>
      </div>
      <BuCcSelect
        bu={f.bu ?? null} cc={f.structure ?? null}
        onChange={(bu, cc) => setF((s) => ({ ...s, bu: bu ?? undefined, structure: cc ?? undefined }))}
        buLabel="Business Unit" ccLabel="Structure" required noneLabel="— Choisir —" />
      <div className="form-r">
        <div className="form-g"><label>Demandeur</label><input value={f.demandeur ?? ''} onChange={set('demandeur')} /></div>
        <div className="form-g" />
      </div>
      <div className="form-r">
        <div className="form-g"><label>Nombre de personnes</label><input type="number" min={0} value={f.pax ?? ''} placeholder="0" onChange={set('pax')} /></div>
        <div className="form-g"><label>Tonnage nécessaire (fret, t)</label><input type="number" step="0.1" min={0} value={f.tonnage ?? ''} placeholder="ex. 3 si transport lourd" onChange={set('tonnage')} /></div>
      </div>
      <div style={{ fontSize: '.68rem', color: 'var(--tm)', marginBottom: 8 }}>
        À l&apos;expression du besoin : le système ne proposera que des véhicules avec assez de places <b>et</b> assez de charge utile.
      </div>
      <div className="form-r">
        <div className="form-g"><label>Priorité</label><select value={f.priorite ?? 'NORMALE'} onChange={set('priorite')}>{['BASSE', 'NORMALE', 'HAUTE', 'URGENTE'].map((p) => <option key={p}>{p}</option>)}</select></div>
        <div className="form-g"><label>Urgence</label><select value={f.urgence ?? 'NORMALE'} onChange={set('urgence')}>{['NORMALE', 'URGENTE'].map((p) => <option key={p}>{p}</option>)}</select></div>
      </div>
      <div className="form-g"><label>Notes</label><textarea value={f.notes ?? ''} onChange={set('notes')} rows={2} /></div>
    </Modal>
  );
}
