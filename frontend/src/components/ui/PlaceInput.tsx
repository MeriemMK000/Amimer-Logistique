'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';
import Modal from '@/components/ui/Modal';
import { suggestPlaces, createPlace } from '@/lib/api/hooks';

const MapPicker = dynamic(() => import('@/components/map/MapPicker'), {
  ssr: false,
  loading: () => <div style={{ height: 360, display: 'grid', placeItems: 'center', color: 'var(--tm)', fontSize: '.8rem' }}>Chargement de la carte…</div>,
});

export interface PlaceGeo { name?: string; lat: number; lon: number }

/**
 * Saisie de lieu **précise** (retour DG : « on doit utiliser des adresses si on veut être
 * précis en km »). Autocomplete sur le référentiel `places` ; si l'adresse exacte n'est pas
 * connue, bouton « 📍 Placer sur la carte » → le point cliqué devient un lieu réutilisable
 * et sert au calcul du kilométrage exact.
 */
export default function PlaceInput({
  value, geo, onChange, placeholder, style,
}: {
  value: string;
  geo?: PlaceGeo | null;
  onChange: (name: string, geo: PlaceGeo | null) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [matches, setMatches] = useState<Array<{ id?: string; name: string; label?: string; lat: number; lon: number; kind?: string; source?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [pin, setPin] = useState<{ lat: number; lon: number } | null>(null);
  const [pinName, setPinName] = useState('');
  const [mapCenter, setMapCenter] = useState<{ lat: number; lon: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  /** Ouvre la carte centrée sur le lieu déjà choisi, ou sur la meilleure correspondance du texte tapé. */
  const openMap = async () => {
    setPinName(value);
    if (geo && geo.lat != null) setMapCenter({ lat: geo.lat, lon: geo.lon });
    else {
      setMapCenter(null);
      const q = value.trim();
      if (q.length >= 2) {
        try { const hits = await suggestPlaces(q); if (hits[0]) setMapCenter({ lat: hits[0].lat, lon: hits[0].lon }); } catch { /* ignore */ }
      }
    }
    setMapOpen(true);
  };

  // Autocomplete « type carte » : référentiel local (instantané) + géocodeur OSM (rues, quartiers…).
  useEffect(() => {
    const q = value.trim();
    if (!q || q.length < 2) { setMatches([]); setLoading(false); return; }
    let alive = true;
    setLoading(true);
    const t = setTimeout(() => {
      suggestPlaces(q).then((r) => { if (alive) setMatches(r); }).catch(() => undefined).finally(() => { if (alive) setLoading(false); });
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [value]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const exact = matches.find((m) => m.name.toLowerCase() === value.trim().toLowerCase());
  const pick = (p: { id?: string; name: string; label?: string; lat: number; lon: number; source?: string }) => {
    onChange(p.name, { name: p.name, lat: p.lat, lon: p.lon });
    setOpen(false);
    // Résultat du géocodeur (Google / OSM) → on l'enregistre comme lieu réutilisable (cache + hors ligne).
    if (!p.id && (p.source === 'osm' || p.source === 'google')) {
      createPlace({ name: p.name, lat: p.lat, lon: p.lon, kind: 'address', source: p.source }).catch(() => undefined);
    }
  };

  const saveePin = async () => {
    if (!pin) { toast.error('Cliquez d’abord un point sur la carte'); return; }
    const name = (pinName || value).trim() || `Point ${pin.lat.toFixed(4)}, ${pin.lon.toFixed(4)}`;
    try {
      const p = await createPlace({ name, lat: pin.lat, lon: pin.lon, kind: 'pin', source: 'manual' });
      onChange(p.name, { name: p.name, lat: p.lat, lon: p.lon });
      toast.success(`Lieu « ${p.name} » enregistré`);
      setMapOpen(false); setPin(null); setPinName('');
    } catch {
      toast.error('Impossible d’enregistrer le lieu');
    }
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          value={value}
          placeholder={placeholder}
          style={{ flex: 1, ...style }}
          onChange={(e) => { onChange(e.target.value, null); setOpen(true); setHi(0); }}
          onFocus={() => value && setOpen(true)}
          onKeyDown={(e) => {
            if (!open || !matches.length) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, matches.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
            else if (e.key === 'Enter') { e.preventDefault(); pick(matches[hi]); }
            else if (e.key === 'Escape') setOpen(false);
          }}
        />
        <button type="button" title="Placer sur la carte (adresse précise)" className="btn btn-o btn-sm"
          onClick={openMap} style={{ flexShrink: 0 }}>Carte</button>
      </div>

      {geo && geo.lat != null && (
        <div style={{ fontSize: '.64rem', color: 'var(--g6)', marginTop: 2 }}>
          ✓ point précis ({geo.lat.toFixed(4)}, {geo.lon.toFixed(4)})
        </div>
      )}
      {!geo && value.trim().length >= 2 && !exact && (
        <div style={{ fontSize: '.64rem', color: 'var(--a6)', marginTop: 2 }}>
          {loading ? 'recherche du lieu…' : <>Lieu non géolocalisé — <button type="button" onClick={openMap}
            style={{ background: 'none', border: 0, padding: 0, color: 'var(--b6)', textDecoration: 'underline', cursor: 'pointer', fontSize: '.64rem', fontWeight: 600 }}>
            placer sur la carte
          </button> pour un km exact</>}
        </div>
      )}

      {open && matches.length > 0 && (
        <ul style={{
          position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, zIndex: 50,
          listStyle: 'none', margin: 0, padding: 4, maxHeight: 260, overflowY: 'auto',
          background: 'var(--sc)', border: '1px solid var(--bd)', borderRadius: 'var(--rs)',
          boxShadow: '0 8px 24px rgba(0,0,0,.18)',
        }}>
          {matches.map((p, i) => (
            <li key={(p.id ?? '') + p.name + i}
              onMouseDown={(e) => { e.preventDefault(); pick(p); }}
              onMouseEnter={() => setHi(i)}
              style={{
                padding: '6px 10px', fontSize: '.8rem', borderRadius: 6, cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center',
                background: i === hi ? 'var(--b0)' : 'transparent',
                color: i === hi ? 'var(--b6)' : 'var(--tp)',
              }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.label ?? p.name}</span>
              <span style={{ fontSize: '.6rem', color: 'var(--tm)', flexShrink: 0 }}>
                {p.kind === 'pin' ? 'point' : p.source === 'google' ? 'Google' : p.source === 'osm' ? 'carte' : ''}
              </span>
            </li>
          ))}
          {loading && <li style={{ padding: '6px 10px', fontSize: '.7rem', color: 'var(--tm)' }}>recherche…</li>}
        </ul>
      )}

      {mapOpen && (
        <Modal open onClose={() => { setMapOpen(false); setPin(null); }} wide title="Placer le lieu sur la carte"
          footer={<>
            <button className="btn btn-o" onClick={() => { setMapOpen(false); setPin(null); }}>Annuler</button>
            <button className="btn btn-p" onClick={saveePin} disabled={!pin}>Enregistrer ce lieu</button>
          </>}>
          <div style={{ fontSize: '.74rem', color: 'var(--tm)', marginBottom: 8 }}>
            Cliquez l’emplacement exact (nouvelle ville, zone industrielle, base vie…). Le point est enregistré comme lieu réutilisable.
          </div>
          <div className="form-g" style={{ marginBottom: 8 }}>
            <label>Nom du lieu</label>
            <input value={pinName} onChange={(e) => setPinName(e.target.value)} placeholder="ex. Nouvelle ville Tizi Ouzou" />
          </div>
          <MapPicker initial={mapCenter} onPick={setPin} />
          {pin && <div style={{ fontSize: '.72rem', color: 'var(--g6)', marginTop: 6 }}>Point : {pin.lat.toFixed(5)}, {pin.lon.toFixed(5)}</div>}
        </Modal>
      )}
    </div>
  );
}
