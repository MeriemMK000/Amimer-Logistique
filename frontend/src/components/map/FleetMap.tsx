'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { dzGeo } from '@/lib/reference/gps';
import type { Mission, Vehicle } from '@/lib/types';

function cityCoord(name: string | null | undefined): [number, number] | null {
  if (!name) return null;
  const sl = name.trim().toLowerCase();
  let best: string | null = null;
  let bestLen = 0;
  for (const k of Object.keys(dzGeo)) {
    const kl = k.toLowerCase();
    if (sl === kl) { best = k; break; }
    if (sl.includes(kl) && kl.length > bestLen) { best = k; bestLen = kl.length; }
  }
  if (!best) return null;
  const c = dzGeo[best];
  return [c.lat, c.lon];
}

const icon = (color: string) =>
  L.divIcon({
    className: '',
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

const STATUS_COLOR: Record<string, string> = { EN_COURS: '#16a34a', PLANIFIEE: '#2563eb', TERMINEE: '#d97706' };

// Cache mémoire des itinéraires OSRM (clé = suite de coords).
const routeCache = new Map<string, [number, number][]>();

async function osrmRoute(points: [number, number][]): Promise<[number, number][] | null> {
  if (points.length < 2) return null;
  const key = points.map((p) => `${p[1].toFixed(4)},${p[0].toFixed(4)}`).join(';');
  if (routeCache.has(key)) return routeCache.get(key)!;
  try {
    const coordStr = points.map((p) => `${p[1]},${p[0]}`).join(';');
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`);
    if (!res.ok) return null;
    const json = await res.json();
    const line = json.routes?.[0]?.geometry?.coordinates as [number, number][] | undefined;
    if (!line) return null;
    const latlngs = line.map(([lon, lat]) => [lat, lon] as [number, number]);
    routeCache.set(key, latlngs);
    return latlngs;
  } catch {
    return null;
  }
}

interface EstPos {
  missionNum: string; vehicleCode: string | null; driverCode?: string | null; from: string; to: string;
  lat: number; lon: number; pctDone: number; etaMin: number | null;
  distanceCoveredKm: number; distanceTotalKm: number; speedKmh: number;
}

function FitBounds({ pts }: { pts: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (pts.length === 1) { map.setView(pts[0], 11); return; }
    if (pts.length > 1) map.fitBounds(pts as L.LatLngBoundsLiteral, { padding: [40, 40], maxZoom: 12 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(pts)]);
  return null;
}

export default function FleetMap({
  missions, vehicles, estimated = [], drName, height = 560, fitToData = false,
}: {
  missions: Mission[]; vehicles: Vehicle[];
  estimated?: EstPos[]; drName?: (c: string | null) => string;
  height?: number; fitToData?: boolean;
}) {
  const [routes, setRoutes] = useState<Record<string, [number, number][]>>({});

  const vLabel = (c: string | null) => {
    const v = vehicles.find((x) => x.code === c);
    return v ? `${v.brand} ${v.model}` : '';
  };

  const segments = missions
    .map((m) => {
      const from = cityCoord(m.fromLoc);
      const to = cityCoord(m.toLoc);
      if (!from || !to) return null;
      const wp = (m.waypoints ?? []).map(cityCoord).filter(Boolean) as [number, number][];
      return { m, points: [from, ...wp, to] as [number, number][], from, to };
    })
    .filter(Boolean) as { m: Mission; points: [number, number][]; from: [number, number]; to: [number, number] }[];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const seg of segments) {
        const real = await osrmRoute(seg.points);
        if (cancelled) return;
        if (real) setRoutes((r) => ({ ...r, [seg.m.num]: real }));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missions]);

  const allPts: [number, number][] = [
    ...segments.flatMap((s) => s.points),
    ...estimated.map((e) => [e.lat, e.lon] as [number, number]),
  ];

  return (
    <MapContainer center={[35.5, 3.5]} zoom={6} style={{ width: '100%', height, borderRadius: 8 }} scrollWheelZoom>
      {fitToData && allPts.length > 0 && <FitBounds pts={allPts} />}
      {/* Fond de carte Esri (ArcGIS) — sans clé API, sans blocage "Referer"
          (les serveurs tile.openstreetmap.org renvoient 403 derrière un tunnel). */}
      <TileLayer
        attribution="Tiles &copy; Esri — Esri, HERE, Garmin, &copy; OpenStreetMap contributors"
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
        maxZoom={19}
      />
      {segments.map(({ m, points, from, to }) => {
        const color = STATUS_COLOR[m.status] ?? '#8892a8';
        const line = routes[m.num] ?? points;
        const pos: [number, number] = m.status === 'EN_COURS'
          ? line[Math.floor(line.length / 2)] ?? from
          : from;
        return (
          <div key={m.num}>
            <Polyline positions={line} pathOptions={{ color, weight: 3, opacity: 0.75, dashArray: m.status === 'PLANIFIEE' ? '6 6' : undefined }} />
            <Marker position={pos} icon={icon(color)}>
              <Popup>
                <b>{m.num}</b><br />
                {m.fromLoc} → {m.toLoc}<br />
                Véhicule : {m.vehicleCode || '—'} {vLabel(m.vehicleCode)}<br />
                {m.distance} km · {m.status}
              </Popup>
            </Marker>
            <Marker position={to} icon={icon('#8892a8')}>
              <Popup>{m.toLoc}</Popup>
            </Marker>
          </div>
        );
      })}
      {estimated.map((e) => (
        <Marker
          key={`est-${e.missionNum}`}
          position={[e.lat, e.lon]}
          icon={L.divIcon({
            className: '',
            html: `<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#16a34a;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.5)"></div>`,
            iconSize: [22, 22],
            iconAnchor: [11, 22],
          })}
        >
          <Popup>
            <b>{e.vehicleCode || '—'}</b> · {e.missionNum}<br />
            {drName && e.driverCode ? <>Chauffeur : {drName(e.driverCode)}<br /></> : null}
            {e.from} → {e.to}<br />
            Position estimée : {Math.round(e.pctDone * 100)}% ({e.distanceCoveredKm}/{e.distanceTotalKm} km)<br />
            {e.pctDone >= 1 ? 'Arrivé' : `ETA ${e.etaMin} min`} · {e.speedKmh} km/h
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
