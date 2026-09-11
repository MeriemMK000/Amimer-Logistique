'use client';

import { useState } from 'react';
import Tabs from '@/components/ui/Tabs';
import Modal from '@/components/ui/Modal';
import PeriodPicker from '@/components/ui/PeriodPicker';
import SearchBox from '@/components/ui/SearchBox';
import DateInput from '@/components/ui/DateInput';
import { useSearch } from '@/lib/useSearch';
import { usePeriod } from '@/lib/period';
import { fd, fk } from '@/lib/fleet/format';
import {
  useAddCardMovement, useConfig, useConfirmedRemove, useCreate,
  useFuelCardMovements, useFuelCardSummary, useFuelCards, useImportFuelCard, useVehicles,
} from '@/lib/api/hooks';

const TABS = ['Cartes', 'Mouvements & import'];

function G({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="form-g"><label>{label}</label>{children}</div>;
}

export default function CartesCarburantPanel() {
  const [tab, setTab] = useState(0);
  return (
    <div className="tpane act">
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 0 && <CardsTab />}
      {tab === 1 && <MovementsTab />}
    </div>
  );
}

/* ─── Cartes ─── */
function CardsTab() {
  const period = usePeriod();
  const cards = useFuelCards();
  const vehicles = useVehicles();
  // Gestionnaires : liste éditée dans Paramètres › Listes Flotte (retour DG — pas de saisie libre).
  const mgrCfg = useConfig<string[]>('FUEL_CARD_MANAGERS');
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const managers = (() => {
    const seen = new Map<string, string>();
    for (const s of [...(Array.isArray(mgrCfg.data) ? mgrCfg.data : []), ...((cards.data ?? []) as any[]).map((c) => c.manager)]) {
      const v = String(s ?? '').trim();
      if (v && !seen.has(norm(v))) seen.set(norm(v), v);
    }
    return [...seen.values()].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  })();
  const create = useCreate<any>('fuel-cards');
  const remove = useConfirmedRemove('fuel-cards', 'cette carte');
  const addMv = useAddCardMovement();
  const summary = useFuelCardSummary(period.mode === 'cumul' ? undefined : period.month);
  const [open, setOpen] = useState(false);
  const [F, setF] = useState<any>({ active: true });
  const [loadFor, setLoadFor] = useState<any>(null);
  const [loadAmt, setLoadAmt] = useState('');
  const [fillFor, setFillFor] = useState<any>(null);
  const [fill, setFill] = useState<any>({});

  const sumOf = (id: string) => summary.data?.find((s: any) => s.cardId === id);

  return (
    <div className="cc">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div><h3>Cartes carburant</h3><div className="sub">Affectées à un véhicule · chargement mensuel · plafond.</div></div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <PeriodPicker period={period} />
          <button className="btn btn-p" onClick={() => setOpen(true)}>+ Carte</button>
        </div>
      </div>
      <div className="tw" style={{ marginTop: 10 }}>
        <table>
          <thead><tr><th>N° Carte</th><th>Gestionnaire</th><th>Véhicule</th><th>Plafond/mois</th><th>Conso période (L)</th><th>Montant période</th><th /></tr></thead>
          <tbody>
            {(cards.data ?? []).map((c: any) => {
              const s = sumOf(c.id);
              return (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.cardNumber}</td>
                  <td>{c.manager}</td>
                  <td>{c.vehicleCode || '—'}</td>
                  <td>{c.monthlyCap ? `${fk(c.monthlyCap)} DZD` : '—'}</td>
                  <td>{s ? fk(s.liters) : '0'}</td>
                  <td style={{ color: s?.overCap ? 'var(--r6)' : undefined, fontWeight: s?.overCap ? 700 : 400 }}>
                    {s ? `${fk(s.amount)} DZD` : '0'}{s?.overCap ? ' — dépassé' : ''}
                  </td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-p btn-sm" onClick={() => { setFillFor(c); setFill({ vehicleCode: c.vehicleCode ?? '', date: new Date().toISOString().slice(0, 10) }); }}>+ Passage</button>
                    <button className="btn btn-o btn-sm" onClick={() => { setLoadFor(c); setLoadAmt(''); }}>Charger crédit</button>
                    <button className="btn btn-o btn-sm" onClick={() => remove(c.id, c.cardNumber)}>Suppr.</button>
                  </td>
                </tr>
              );
            })}
            {!(cards.data ?? []).length && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--tm)', padding: 14 }}>Aucune carte</td></tr>}
          </tbody>
        </table>
      </div>

      {open && (
        <Modal open onClose={() => setOpen(false)} title="Nouvelle carte"
          footer={<><button className="btn btn-o" onClick={() => setOpen(false)}>Annuler</button><button className="btn btn-p" disabled={!F.cardNumber} onClick={async () => { await create.mutateAsync(F); setOpen(false); setF({ active: true }); }}>Enregistrer</button></>}>
          <div className="form-r">
            <G label="N° Carte"><input value={F.cardNumber ?? ''} onChange={(e) => setF({ ...F, cardNumber: e.target.value })} /></G>
            <G label="Gestionnaire">
              <select value={F.manager ?? ''} onChange={(e) => setF({ ...F, manager: e.target.value })}>
                <option value="">— Choisir —</option>
                {managers.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </G>
          </div>
          <div className="form-r">
            <G label="Véhicule affecté">
              <select value={F.vehicleCode ?? ''} onChange={(e) => setF({ ...F, vehicleCode: e.target.value })}>
                <option value="">—</option>
                {vehicles.data?.map((v) => <option key={v.code} value={v.code}>{v.code} — {v.brand} {v.model}</option>)}
              </select>
            </G>
            <G label="Plafond mensuel (DZD)"><input type="number" value={F.monthlyCap ?? ''} onChange={(e) => setF({ ...F, monthlyCap: Number(e.target.value) })} /></G>
          </div>
        </Modal>
      )}

      {loadFor && (
        <Modal open onClose={() => setLoadFor(null)} title={`Charger du crédit — ${loadFor.cardNumber}`}
          footer={<><button className="btn btn-o" onClick={() => setLoadFor(null)}>Annuler</button>
            <button className="btn btn-p" disabled={!loadAmt || addMv.isPending}
              onClick={async () => { await addMv.mutateAsync({ id: loadFor.id, body: { amount: Number(loadAmt), source: 'chargement', date: new Date().toISOString().slice(0, 10) } }); setLoadFor(null); }}>
              Enregistrer</button></>}>
          <p style={{ fontSize: '.74rem', color: 'var(--tm)' }}>Recharge mensuelle de la carte (crédit). Ce n&apos;est pas une consommation — pour un plein, utilisez « + Passage ».</p>
          <div className="form-r">
            <G label="Montant chargé (DZD)"><input type="number" value={loadAmt} onChange={(e) => setLoadAmt(e.target.value)} /></G>
          </div>
        </Modal>
      )}

      {fillFor && (
        <Modal open onClose={() => setFillFor(null)} title={`Passage carte — ${fillFor.cardNumber}`}
          footer={<><button className="btn btn-o" onClick={() => setFillFor(null)}>Annuler</button>
            <button className="btn btn-p" disabled={!fill.vehicleCode || !(Number(fill.liters) > 0 || Number(fill.amount) > 0) || addMv.isPending}
              onClick={async () => {
                await addMv.mutateAsync({ id: fillFor.id, body: {
                  vehicleCode: fill.vehicleCode, date: fill.date,
                  liters: fill.liters ? Number(fill.liters) : null,
                  amount: fill.amount ? Number(fill.amount) : null,
                  station: fill.station || null, km: fill.km ? Number(fill.km) : null,
                  source: 'carte',
                } });
                setFillFor(null);
              }}>Enregistrer le plein</button></>}>
          <p style={{ fontSize: '.74rem', color: 'var(--tm)' }}>Un passage de carte = un plein. Il entre directement dans le contrôle carburant du véhicule (source « carte »).</p>
          <div className="form-r">
            <G label="Véhicule"><select value={fill.vehicleCode ?? ''} onChange={(e) => setFill({ ...fill, vehicleCode: e.target.value })}>
              <option value="">—</option>{vehicles.data?.map((v) => <option key={v.code} value={v.code}>{v.code} — {v.brand} {v.model}</option>)}
            </select></G>
            <G label="Date"><DateInput value={fill.date ?? ''} onChange={(e) => setFill({ ...fill, date: e.target.value })} /></G>
          </div>
          <div className="form-r">
            <G label="Litres"><input type="number" value={fill.liters ?? ''} onChange={(e) => setFill({ ...fill, liters: e.target.value })} placeholder="0" /></G>
            <G label="Montant (DZD)"><input type="number" value={fill.amount ?? ''} onChange={(e) => setFill({ ...fill, amount: e.target.value })} placeholder="calculé si vide" /></G>
          </div>
          <div className="form-r">
            <G label="Station"><input value={fill.station ?? ''} onChange={(e) => setFill({ ...fill, station: e.target.value })} placeholder="facultatif" /></G>
            <G label="Km compteur"><input type="number" value={fill.km ?? ''} onChange={(e) => setFill({ ...fill, km: e.target.value })} placeholder="facultatif" /></G>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─── Mouvements & import ─── */
function MovementsTab() {
  const period = usePeriod();
  const moves = useFuelCardMovements();
  const importCsv = useImportFuelCard();
  const [csv, setCsv] = useState('');

  const periodRows = (moves.data ?? []).filter((m: any) => period.mode === 'cumul' || period.matches(m.date));
  const search = useSearch<any>(periodRows, (m) => [m.date, m.cardNumber, m.vehicleCode, m.station, m.source].join(' '));
  const rows = search.filtered;

  return (
    <div className="cc">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div><h3>Mouvements cartes</h3><div className="sub">Import du fichier mouvements (CSV) ou saisie manuelle mensuelle.</div></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <SearchBox value={search.q} onChange={search.setQ} placeholder="Carte, véhicule, station…" count={search.count} total={periodRows.length} />
          <PeriodPicker period={period} />
        </div>
      </div>
      <div className="tw" style={{ marginTop: 10 }}>
        <table>
          <thead><tr><th>Date</th><th>Carte</th><th>Véhicule</th><th>Litres</th><th>Montant</th><th>Station</th><th>Km</th><th>Source</th></tr></thead>
          <tbody>
            {rows.map((m: any) => (
              <tr key={m.id}>
                <td>{fd(m.date)}</td><td>{m.cardNumber}</td><td>{m.vehicleCode || '—'}</td>
                <td>{m.liters ?? '—'}</td><td>{m.amount ? fk(m.amount) : '—'}</td>
                <td>{m.station || '—'}</td><td>{m.km ? fk(m.km) : '—'}</td>
                <td><span className="bg">{m.source}</span></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--tm)', padding: 12 }}>Aucun mouvement</td></tr>}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 16 }}>
        <h3>Import fichier mouvements (CSV)</h3>
        <div className="sub">Colonnes : cardNumber,date,vehicleCode,liters,amount,station,km</div>
        <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={4} style={{ width: '100%', marginTop: 6, fontFamily: 'monospace', fontSize: '.72rem' }} />
        <button className="btn btn-p" style={{ marginTop: 6 }} disabled={!csv.trim() || importCsv.isPending}
          onClick={async () => {
            const r = await importCsv.mutateAsync(csv);
            alert(`${r.imported} mouvement(s) importé(s)${r.unmatched?.length ? `\nCartes inconnues : ${r.unmatched.join(', ')}` : ''}`);
            setCsv('');
          }}>
          Importer
        </button>
      </div>
    </div>
  );
}

