'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

const pin = L.divIcon({
  className: '',
  html: '<div style="font-size:26px;line-height:1;transform:translate(-2px,-4px)">📍</div>',
  iconSize: [26, 26],
  iconAnchor: [11, 24],
});

/** Recadre + recalcule la taille (Leaflet se dessine mal quand il monte dans une modale). */
function Controller({ center }: { center: { lat: number; lon: number } | null }) {
  const map = useMap();
  useEffect(() => {
    const apply = () => {
      map.invalidateSize();
      if (center) map.setView([center.lat, center.lon], 13, { animate: false });
    };
    apply();
    const t1 = setTimeout(apply, 150);
    const t2 = setTimeout(apply, 450);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [map, center]);
  return null;
}

function ClickCatcher({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({ click(e) { onPick(e.latlng.lat, e.latlng.lng); } });
  return null;
}

/** Carte cliquable : un clic pose le point exact (retour DG : km précis à l'adresse). */
export default function MapPicker({
  initial, onPick, height = 380,
}: {
  initial?: { lat: number; lon: number } | null;
  onPick: (p: { lat: number; lon: number }) => void;
  height?: number;
}) {
  const [pos, setPos] = useState<{ lat: number; lon: number } | null>(initial ?? null);
  // Monter la carte APRÈS que la modale se soit posée (évite le double rendu Leaflet).
  const [ready, setReady] = useState(false);
  useEffect(() => { const t = setTimeout(() => setReady(true), 60); return () => clearTimeout(t); }, []);

  if (!ready) {
    return <div style={{ width: '100%', height, borderRadius: 8, display: 'grid', placeItems: 'center', color: 'var(--tm)', fontSize: '.8rem', background: 'var(--s1)' }}>Chargement de la carte…</div>;
  }

  return (
    <MapContainer center={[35.5, 3.5]} zoom={6} style={{ width: '100%', height, borderRadius: 8 }} scrollWheelZoom>
      <Controller center={initial ?? null} />
      <TileLayer
        attribution="Tiles &copy; Esri"
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
        maxZoom={19}
      />
      <ClickCatcher onPick={(lat, lon) => { setPos({ lat, lon }); onPick({ lat, lon }); }} />
      {pos && <Marker position={[pos.lat, pos.lon]} icon={pin} />}
    </MapContainer>
  );
}
