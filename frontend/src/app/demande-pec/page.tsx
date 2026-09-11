'use client';

import { useState } from 'react';
import { api } from '@/lib/api/client';
import { useBusinessUnits } from '@/lib/api/hooks';
import PlaceInput from '@/components/ui/PlaceInput';
import DateInput from '@/components/ui/DateInput';

const wrap: React.CSSProperties = { minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'Inter,system-ui,sans-serif', background: '#f4f6fb' };
const card: React.CSSProperties = { maxWidth: 580, width: '100%', border: '1px solid #dce1ea', borderRadius: 12, padding: 28, background: '#fff' };
const label: React.CSSProperties = { display: 'block', fontSize: '.78rem', fontWeight: 600, margin: '10px 0 3px', color: '#333' };
const input: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #cbd2df', borderRadius: 6, fontSize: '.9rem', boxSizing: 'border-box' };

export default function DemandePecPage() {
  const [F, setF] = useState<Record<string, string>>({ priorite: 'NORMALE' });
  const [done, setDone] = useState<{ code: string } | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...F, [k]: e.target.value });

  // Business Unit + sa structure (référentiel) — remplace l'ancien champ « Organisation » libre.
  const bus = useBusinessUnits();
  const buList = bus.data ?? [];
  const ccList = buList.find((b) => b.code === F.bu)?.ca ?? [];

  const submit = async () => {
    setErr(''); setBusy(true);
    try {
      const { data } = await api.post('/dpc-requests/public', {
        requesterName: F.requesterName, phone: F.phone, email: F.email,
        bu: F.bu, structure: F.structure,
        fromLoc: F.fromLoc, toLoc: F.toLoc, dateAller: F.dateAller, dateRetour: F.dateRetour,
        pax: F.pax ? Number(F.pax) : null, tonnage: F.tonnage ? Number(F.tonnage) : null,
        priorite: F.priorite, notes: F.notes,
      });
      setDone({ code: data.code });
    } catch (e) {
      setErr((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erreur lors de l’envoi');
    } finally { setBusy(false); }
  };

  if (done) {
    return (
      <div style={wrap}>
        <div style={{ ...card, textAlign: 'center' }}>
          
          <h2 style={{ color: '#15803d' }}>Demande enregistrée</h2>
          <p>Votre référence : <b>{done.code}</b></p>
          <p style={{ fontSize: '.85rem', color: '#8892a8' }}>La logistique d’Amimer Logistique va étudier votre demande de prise en charge et vous recontactera.</p>
          <button onClick={() => { setDone(null); setF({ priorite: 'NORMALE' }); }} style={{ marginTop: 14, padding: '8px 16px', background: '#eef2ff', color: '#1e40af', border: '1px solid #c7d2fe', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>Nouvelle demande</button>
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ fontWeight: 800, fontSize: '1.15rem', color: '#1e40af' }}>Demande de prise en charge — transport</div>
        <p style={{ fontSize: '.82rem', color: '#8892a8', marginTop: 4 }}>Formulaire public — aucun compte requis. Votre demande entre directement dans la file de la logistique.</p>

        <label style={label}>Nom et prénom *</label>
        <input style={input} value={F.requesterName ?? ''} onChange={set('requesterName')} />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 160px' }}><label style={label}>Téléphone</label><input style={input} value={F.phone ?? ''} onChange={set('phone')} /></div>
          <div style={{ flex: '1 1 160px' }}><label style={label}>Email</label><input style={input} type="email" value={F.email ?? ''} onChange={set('email')} /></div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 160px' }}>
            <label style={label}>Business Unit *</label>
            <select style={input} value={F.bu ?? ''} onChange={(e) => setF({ ...F, bu: e.target.value, structure: '' })}>
              <option value="">— Choisir —</option>
              {buList.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
            </select>
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <label style={label}>Structure *</label>
            <select style={input} value={F.structure ?? ''} disabled={!F.bu || !ccList.length}
              onChange={(e) => setF({ ...F, structure: e.target.value })}>
              <option value="">{F.bu ? (ccList.length ? '— Choisir —' : 'Aucune structure définie') : 'Choisir une BU d’abord'}</option>
              {ccList.map((c) => <option key={c.code} value={c.code}>{c.nom}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 160px' }}><label style={label}>Lieu de départ *</label>
            <PlaceInput value={F.fromLoc ?? ''} onChange={(v) => setF({ ...F, fromLoc: v })} style={input} placeholder="Commune, rue ou adresse précise…" />
          </div>
          <div style={{ flex: '1 1 160px' }}><label style={label}>Destination *</label>
            <PlaceInput value={F.toLoc ?? ''} onChange={(v) => setF({ ...F, toLoc: v })} style={input} placeholder="Commune, rue ou adresse précise…" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 130px' }}><label style={label}>Date aller *</label><DateInput style={input} value={F.dateAller ?? ''} onChange={set('dateAller')} /></div>
          <div style={{ flex: '1 1 130px' }}><label style={label}>Date retour</label><DateInput style={input} value={F.dateRetour ?? ''} onChange={set('dateRetour')} /></div>
          <div style={{ width: 80 }}><label style={label}>Pax</label><input style={input} type="number" value={F.pax ?? ''} onChange={set('pax')} /></div>
          <div style={{ width: 120 }}><label style={label}>Tonnage (t)</label><input style={input} type="number" step="0.1" value={F.tonnage ?? ''} onChange={set('tonnage')} placeholder="si fret" /></div>
          <div style={{ flex: '1 1 120px' }}><label style={label}>Priorité</label>
            <select style={input} value={F.priorite ?? 'NORMALE'} onChange={set('priorite')}>
              {['BASSE', 'NORMALE', 'HAUTE', 'URGENTE'].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <label style={label}>Précisions (optionnel)</label>
        <textarea style={{ ...input, minHeight: 60 }} value={F.notes ?? ''} onChange={set('notes')} />

        {err && <p style={{ color: '#b91c1c', fontSize: '.82rem', marginTop: 10 }}>{err}</p>}
        <button
          onClick={submit}
          disabled={busy || !F.requesterName || !F.fromLoc || !F.toLoc || !F.dateAller || !F.bu || (ccList.length > 0 && !F.structure)}
          style={{ marginTop: 16, width: '100%', padding: '10px', background: '#1e40af', color: '#fff', border: 0, borderRadius: 8, fontWeight: 700, fontSize: '.9rem', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Envoi…' : 'Envoyer la demande'}
        </button>
      </div>
    </div>
  );
}
