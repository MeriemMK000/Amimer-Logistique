'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import Tabs from '@/components/ui/Tabs';
import Modal from '@/components/ui/Modal';
import SearchBox from '@/components/ui/SearchBox';
import DateInput from '@/components/ui/DateInput';
import { useSearch } from '@/lib/useSearch';
import { fd, fk } from '@/lib/fleet/format';
import { printReport } from '@/lib/export';
import {
  useConfirmedRemove, useControlRequests, useCreate, useGenerateControls, useIncidents, useIncidentStatus,
  useRespondControl, useVehicles,
} from '@/lib/api/hooks';

const CTRL_ETATS = [
  { v: 'bon', l: 'Bon', c: 'var(--g6)' },
  { v: 'moyen', l: 'Moyen', c: 'var(--a6)' },
  { v: 'mauvais', l: 'Mauvais', c: 'var(--r6)' },
];

const TABS = ['Incidents & Sinistres', 'Contrôles périodiques'];

const INCIDENT_TYPES = [
  'Accident de la circulation', 'Bris de glace', 'Vol du véhicule', 'Vol d’accessoires',
  'Incendie', 'Vandalisme / dégradation', 'Choc / heurt', 'Catastrophe naturelle', 'Panne majeure',
];

const INC_FLOW = ['declare', 'envoye_assurance', 'prise_en_charge', 'en_remboursement', 'clos'];
const INC_LABEL: Record<string, string> = {
  declare: 'Déclaré', envoye_assurance: 'Envoyé assurance', prise_en_charge: 'Prise en charge',
  en_remboursement: 'En remboursement', clos: 'Clos',
};

function G({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="form-g"><label>{label}</label>{children}</div>;
}

export default function IncidentsPage() {
  const [tab, setTab] = useState(0);
  return (
    <div className="page active">
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 0 && <IncidentsTab />}
      {tab === 1 && <ControlsTab />}
    </div>
  );
}

function IncidentsTab() {
  const list = useIncidents();
  const vehicles = useVehicles();
  const create = useCreate<any>('incidents');
  const remove = useConfirmedRemove('incidents', 'ce dossier');
  const changeStatus = useIncidentStatus();
  const [open, setOpen] = useState(false);
  const [F, setF] = useState<any>({});
  const [detail, setDetail] = useState<any>(null);

  const allRows = (list.data ?? []) as any[];
  const search = useSearch(allRows, (i) => [i.date, i.vehicleCode, i.type, i.status, i.description].join(' '));
  const rows = search.filtered;

  const save = async () => {
    const type = (F.type ?? '').trim();
    const miss = [!F.vehicleCode && 'véhicule', !F.date && 'date', !type && 'type d’incident'].filter(Boolean);
    if (miss.length) { toast.error(`Champs obligatoires : ${miss.join(', ')}`); return; }
    try {
      await create.mutateAsync({ ...F, type, estimatedCost: F.estimatedCost ? Number(F.estimatedCost) : null });
      setOpen(false);
      setF({});
    } catch (e) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erreur');
    }
  };

  return (
    <div className="cc">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div><h3>Incidents / Sinistres</h3><div className="sub">Déclaration → assurance → prise en charge → remboursement → clôture (MAJ fiche véhicule).</div></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <SearchBox value={search.q} onChange={search.setQ} placeholder="Véhicule, type, statut…" count={search.count} total={allRows.length} />
          <button className="btn btn-p" onClick={() => setOpen(true)}>+ Déclarer</button>
        </div>
      </div>
      <div className="tw" style={{ marginTop: 10 }}>
        <table>
          <thead><tr><th>Date</th><th>Véhicule</th><th>Type</th><th>Statut</th><th>Coût estimé</th><th>Remb.</th><th>Alerte</th><th /></tr></thead>
          <tbody>
            {rows.map((i: any) => (
              <tr key={i.id} style={{ cursor: 'pointer' }} onClick={() => setDetail(i)}>
                <td>{fd(i.date)}</td><td style={{ fontWeight: 600 }}>{i.vehicleCode}</td><td>{i.type}</td>
                <td><span className="bg">{INC_LABEL[i.status] ?? i.status}</span></td>
                <td>{i.estimatedCost ? `${fk(i.estimatedCost)} DZD` : '—'}</td>
                <td>{i.reimbursementAmount ? `${fk(i.reimbursementAmount)} DZD` : '—'}</td>
                <td>{i.delayAlert ? <span style={{ color: 'var(--r6)', fontSize: '.72rem' }}>{i.delayAlert}</span> : '—'}</td>
                <td onClick={(e) => e.stopPropagation()}><button className="btn btn-o btn-sm" onClick={() => remove(i.id, `${i.vehicleCode} ${fd(i.date)}`)}>Suppr.</button></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--tm)', padding: 14 }}>Aucun incident</td></tr>}
          </tbody>
        </table>
      </div>

      {open && (
        <Modal open onClose={() => setOpen(false)} title="Déclarer un incident"
          footer={<><button className="btn btn-o" onClick={() => setOpen(false)}>Annuler</button><button className="btn btn-p" disabled={!F.vehicleCode || !F.date || create.isPending} onClick={save}>Déclarer</button></>}>
          <div className="form-r">
            <G label="Véhicule">
              <select value={F.vehicleCode ?? ''} onChange={(e) => setF({ ...F, vehicleCode: e.target.value })}>
                <option value="">—</option>
                {vehicles.data?.map((v) => <option key={v.code} value={v.code}>{v.code} — {v.brand} {v.model}</option>)}
              </select>
            </G>
            <G label="Date"><DateInput value={F.date ?? ''} onChange={(e) => setF({ ...F, date: e.target.value })} /></G>
          </div>
          <div className="form-r">
            <G label="Type">
              <select value={INCIDENT_TYPES.includes(F.type) ? F.type : (F.type ? '__autre' : '')}
                onChange={(e) => setF({ ...F, type: e.target.value === '__autre' ? ' ' : e.target.value })}>
                <option value="">— choisir —</option>
                {INCIDENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                <option value="__autre">Autre (préciser)…</option>
              </select>
              {F.type !== undefined && F.type !== '' && !INCIDENT_TYPES.includes(F.type) && (
                <input style={{ marginTop: 6 }} value={F.type.trim() === '' ? '' : F.type} placeholder="Précise le type"
                  onChange={(e) => setF({ ...F, type: e.target.value || ' ' })} />
              )}
            </G>
            <G label="Coût estimé (DZD)"><input type="number" value={F.estimatedCost ?? ''} onChange={(e) => setF({ ...F, estimatedCost: e.target.value })} /></G>
          </div>
          <div className="form-r">
            <G label="Description"><textarea rows={3} value={F.description ?? ''} onChange={(e) => setF({ ...F, description: e.target.value })} /></G>
          </div>
        </Modal>
      )}

      {detail && (
        <Modal open onClose={() => setDetail(null)} title={`Dossier — ${detail.vehicleCode} (${fd(detail.date)})`}
          footer={<button className="btn btn-o" onClick={() => setDetail(null)}>Fermer</button>}>
          <p><b>Type :</b> {detail.type}</p>
          <p style={{ margin: '6px 0' }}>{detail.description}</p>
          <p><b>Coût estimé :</b> {detail.estimatedCost ? `${fk(detail.estimatedCost)} DZD` : '—'}</p>
          {detail.delayAlert && <p style={{ color: 'var(--r6)' }}>{detail.delayAlert}</p>}

          <h4 style={{ marginTop: 12 }}>Avancement du dossier</h4>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
            {INC_FLOW.map((st) => (
              <button key={st}
                className={`btn btn-sm ${detail.status === st ? 'btn-p' : 'btn-o'}`}
                disabled={changeStatus.isPending}
                onClick={async () => { const u = await changeStatus.mutateAsync({ id: detail.id, status: st }); setDetail({ ...detail, ...u }); }}>
                {INC_LABEL[st]}
              </button>
            ))}
          </div>
          {detail.status === 'en_remboursement' && (
            <RembForm incident={detail} onDone={(u) => setDetail({ ...detail, ...u })} />
          )}
          <h4 style={{ marginTop: 12 }}>Historique</h4>
          <ul style={{ fontSize: '.75rem', color: 'var(--tm)' }}>
            {(detail.statusHistory ?? []).map((h: any, k: number) => (
              <li key={k}>{h.at?.slice(0, 10)} — {INC_LABEL[h.status] ?? h.status}{h.note ? ` (${h.note})` : ''}</li>
            ))}
          </ul>
        </Modal>
      )}
    </div>
  );
}

function RembForm({ incident, onDone }: { incident: any; onDone: (u: any) => void }) {
  const [amt, setAmt] = useState(incident.reimbursementAmount ?? '');
  const [exp, setExp] = useState(incident.reimbursementExpectedAt ?? '');
  return (
    <div className="form-r" style={{ marginTop: 8 }}>
      <G label="Montant remboursement (DZD)"><input type="number" value={amt} onChange={(e) => setAmt(e.target.value)} /></G>
      <G label="Remboursement attendu le"><DateInput value={exp} onChange={(e) => setExp(e.target.value)} /></G>
      <div className="form-g" style={{ alignSelf: 'end' }}>
        <button className="btn btn-p btn-sm" onClick={async () => {
          const { api } = await import('@/lib/api/client');
          const { data } = await api.patch(`/incidents/${incident.id}`, {
            reimbursementAmount: amt ? Number(amt) : null,
            reimbursementExpectedAt: exp || null,
          });
          onDone(data);
        }}>Enregistrer</button>
      </div>
    </div>
  );
}

const DEFAULT_CTRL_CATS = [
  { key: 'general', label: 'État général' },
  { key: 'mecanique', label: 'Mécanique (moteur, transmission, freinage)' },
  { key: 'suspension', label: 'Suspension' },
  { key: 'documents', label: 'Documents' },
  { key: 'feux', label: 'Feux et signalisation' },
  { key: 'pneumatique', label: 'Pneumatique' },
];

function ControlsTab() {
  const list = useControlRequests();
  const vehicles = useVehicles();
  const respond = useRespondControl();
  const generate = useGenerateControls();
  const [target, setTarget] = useState<any>(null);
  const [R, setR] = useState<{ km: string; note: string; cats: Record<string, { etat: string; maintenance: boolean; comment: string }>; extra: { key: string; label: string }[] }>({ km: '', note: '', cats: {}, extra: [] });

  const allRows = (list.data ?? []) as any[];
  const vLabel = (c: string) => {
    const v = vehicles.data?.find((x) => x.code === c);
    return v ? `${v.brand ?? ''} ${v.model ?? ''}`.trim() : c;
  };
  const pendingSearch = useSearch(allRows.filter((r) => r.status === 'pending'), (r) => [r.vehicleCode, vLabel(r.vehicleCode), r.reason].join(' '));
  const doneSearch = useSearch(allRows.filter((r) => r.status === 'done'), (r) => [r.vehicleCode, vLabel(r.vehicleCode), r.etat, r.note].join(' '));
  const pending = pendingSearch.filtered;
  const done = doneSearch.filtered;

  const openRespond = (r: any) => {
    const baseCats = (Array.isArray(r.categories) && r.categories.length ? r.categories : DEFAULT_CTRL_CATS);
    setR({
      km: r.km ?? '', note: '',
      cats: Object.fromEntries(baseCats.map((c: any) => [c.key, { etat: c.etat ?? '', maintenance: !!c.maintenance, comment: c.comment ?? '' }])),
      extra: [],
    });
    setTarget(r);
  };
  const catList = target ? [...(Array.isArray(target.categories) && target.categories.length ? target.categories : DEFAULT_CTRL_CATS), ...R.extra] : [];
  const anyFlag = catList.some((c) => R.cats[c.key]?.etat === 'mauvais' || R.cats[c.key]?.maintenance);
  const rated = catList.filter((c) => R.cats[c.key]?.etat);
  const autoScore = rated.length ? Math.round((rated.reduce((s, c) => s + ({ bon: 18, moyen: 12, mauvais: 6 }[R.cats[c.key].etat] ?? 0), 0) / rated.length) * 10) / 10 : null;

  const EMPTY_CAT = { etat: '', maintenance: false, comment: '' };
  const setCat = (key: string, patch: Partial<{ etat: string; maintenance: boolean; comment: string }>) =>
    setR((s) => ({ ...s, cats: { ...s.cats, [key]: { ...EMPTY_CAT, ...s.cats[key], ...patch } } }));

  const submit = async () => {
    const categories = catList.map((c) => ({ key: c.key, label: c.label, ...(R.cats[c.key] ?? { etat: '', maintenance: false, comment: '' }) }));
    await respond.mutateAsync({ id: target.id, body: { km: R.km ? Number(R.km) : undefined, note: R.note || undefined, categories } });
    toast.success(anyFlag ? 'Contrôle enregistré — OT curatif créé' : 'Contrôle enregistré');
    setTarget(null);
  };

  return (
    <>
      <div className="cc">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div><h3>Contrôles à réaliser</h3><div className="sub">Tirage aléatoire pondéré : volume km · panne récente · entretien récent · post-accident · état passé critique · aléatoire. Minimum 1 contrôle / 6 mois par véhicule &amp; engin.</div></div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <SearchBox value={pendingSearch.q} onChange={pendingSearch.setQ} placeholder="Véhicule, motif…" count={pending.length} total={allRows.filter((r) => r.status === 'pending').length} />
            <button className="btn btn-o btn-sm" disabled={generate.isPending} onClick={async () => { const r = await generate.mutateAsync(); toast.success(`${r.created} demande(s) générée(s)`); }}>↻ Générer</button>
          </div>
        </div>
        <div className="tw" style={{ marginTop: 10 }}>
          <table>
            <thead><tr><th>Véhicule</th><th>Généré</th><th>Échéance</th><th>Motif</th><th>Poids</th><th /></tr></thead>
            <tbody>
              {pending.map((r: any) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.vehicleCode} — {vLabel(r.vehicleCode)}</td>
                  <td>{r.generatedAt}</td>
                  <td style={{ color: r.dueDate < new Date().toISOString().slice(0, 10) ? 'var(--r6)' : undefined }}>{r.dueDate}</td>
                  <td style={{ fontSize: '.72rem' }}>{r.reason}</td>
                  <td>{r.weight}</td>
                  <td><button className="btn btn-p btn-sm" onClick={() => openRespond(r)}>Remplir la fiche</button></td>
                </tr>
              ))}
              {!pending.length && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--tm)', padding: 12 }}>Aucun contrôle en attente</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="cc" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <h3>Contrôles réalisés</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <SearchBox value={doneSearch.q} onChange={doneSearch.setQ} placeholder="Véhicule, état…" count={done.length} total={allRows.filter((r) => r.status === 'done').length} />
            <button className="btn btn-o btn-sm" onClick={() => printReport('Contrôles périodiques réalisés', undefined, [{
              columns: ['Véhicule', 'Répondu', 'Km', 'État général', 'Note', 'Rubriques mauvaises', 'OT créé', 'Commentaire'],
              rows: done.map((r: any) => [r.vehicleCode, r.respondedAt, r.km ?? '—', r.etat ?? '—', r.score ?? '—',
                (Array.isArray(r.categories) ? r.categories.filter((c: any) => c.etat === 'mauvais').map((c: any) => c.label).join(', ') : '') || '—',
                r.otNum ?? '—', r.note ?? '—']),
            }])}>Imprimer l&apos;état</button>
          </div>
        </div>
        <div className="tw" style={{ marginTop: 8 }}>
          <table>
            <thead><tr><th>Véhicule</th><th>Répondu</th><th>Km</th><th>État général</th><th>Note</th><th>Rubriques</th><th>OT</th><th>Commentaire</th></tr></thead>
            <tbody>
              {done.map((r: any) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.vehicleCode}</td><td>{r.respondedAt}</td>
                  <td>{r.km != null ? fk(r.km) : '—'}</td>
                  <td><span style={{ color: r.etat === 'mauvais' ? 'var(--r6)' : r.etat === 'moyen' ? 'var(--a6)' : 'var(--g6)', fontWeight: 600 }}>{r.etat ?? '—'}</span></td>
                  <td style={{ fontWeight: 600 }}>{r.score ?? '—'}</td>
                  <td style={{ fontSize: '.68rem' }}>
                    {Array.isArray(r.categories)
                      ? r.categories.filter((c: any) => c.etat).map((c: any) => <span key={c.key} style={{ marginRight: 4, color: c.etat === 'mauvais' ? 'var(--r6)' : c.etat === 'moyen' ? 'var(--a6)' : 'var(--tm)' }}>{c.label.split(' ')[0]}:{c.etat}</span>)
                      : '—'}
                  </td>
                  <td>{r.otNum ? <span className="bg bg-r">{r.otNum}</span> : '—'}</td>
                  <td style={{ fontSize: '.72rem' }}>{r.note ?? '—'}</td>
                </tr>
              ))}
              {!done.length && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--tm)', padding: 12 }}>Aucun</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {target && (
        <Modal open onClose={() => setTarget(null)} wide title={`Fiche de contrôle — ${target.vehicleCode} ${vLabel(target.vehicleCode)}`}
          footer={<><button className="btn btn-o" onClick={() => setTarget(null)}>Annuler</button>
            <button className="btn btn-p" disabled={respond.isPending} onClick={submit}>
              {anyFlag ? 'Valider → OT curatif + évaluation' : 'Valider → évaluation véhicule + chauffeur'}
            </button></>}>
          <div className="form-r">
            <G label="Relevé km"><input type="number" value={R.km} onChange={(e) => setR({ ...R, km: e.target.value })} /></G>
            <G label="Note calculée"><input readOnly value={autoScore ?? '—'} style={{ fontWeight: 700 }} /></G>
          </div>
          <div style={{ fontSize: '.78rem', fontWeight: 600, margin: '10px 0 6px' }}>Rubriques — état & signalement (commentaire facultatif)</div>
          <div className="tw"><table style={{ fontSize: '.74rem' }}>
            <thead><tr><th>Rubrique</th><th>État</th><th>Signaler maintenance</th><th>Commentaire</th></tr></thead>
            <tbody>
              {catList.map((c) => {
                const cur = R.cats[c.key] ?? { etat: '', maintenance: false, comment: '' };
                return (
                  <tr key={c.key}>
                    <td style={{ fontWeight: 600 }}>{c.label}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {CTRL_ETATS.map((e) => (
                          <button key={e.v} type="button" className={`btn btn-sm ${cur.etat === e.v ? 'btn-p' : 'btn-o'}`}
                            style={{ fontSize: '.62rem', padding: '2px 8px', ...(cur.etat === e.v && e.v === 'mauvais' ? { background: 'var(--r6)', borderColor: 'var(--r6)' } : {}) }}
                            onClick={() => setCat(c.key, { etat: e.v })}>{e.l}</button>
                        ))}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}><input type="checkbox" checked={cur.maintenance} onChange={(e) => setCat(c.key, { maintenance: e.target.checked })} /></td>
                    <td><input value={cur.comment} onChange={(e) => setCat(c.key, { comment: e.target.value })} style={{ width: '100%' }} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
          <button type="button" className="btn btn-o btn-sm" style={{ marginTop: 6 }}
            onClick={() => { const k = `custom${R.extra.length + 1}`; const label = prompt('Nom du point de contrôle :'); if (label) setR((s) => ({ ...s, extra: [...s.extra, { key: k, label }] })); }}>
            + Ajouter un point de contrôle
          </button>
          <G label="Commentaire général"><input value={R.note} onChange={(e) => setR({ ...R, note: e.target.value })} /></G>
          {anyFlag && <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 'var(--rs)', background: 'var(--r1)', color: 'var(--r6)', fontSize: '.75rem', fontWeight: 600 }}>Un OT curatif sera créé pour les points mauvais / signalés.</div>}
        </Modal>
      )}
    </>
  );
}
