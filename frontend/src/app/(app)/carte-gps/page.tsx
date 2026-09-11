'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useDrivers, useGpsPositions, useMissions, useNearestVehicle, useVehicles } from '@/lib/api/hooks';
import { icons } from '@/components/ui/icons';
import PeriodPicker from '@/components/ui/PeriodPicker';
import CityInput from '@/components/ui/CityInput';
import { usePeriod } from '@/lib/period';
import { fk } from '@/lib/fleet/format';

const FleetMap = dynamic(() => import('@/components/map/FleetMap'), {
  ssr: false,
  loading: () => <div style={{ height: 560, display: 'grid', placeItems: 'center', color: 'var(--tm)' }}>Chargement de la carte…</div>,
});

export default function CarteGpsPage() {
  const period = usePeriod();
  const missions = useMissions();
  const vehicles = useVehicles();
  const drivers = useDrivers();
  const positions = useGpsPositions(false);
  const nearest = useNearestVehicle();
  const [filter, setFilter] = useState<'actives' | 'all'>('actives');
  const [loc, setLoc] = useState('');
  const [nearestRes, setNearestRes] = useState<any[] | null>(null);

  const MI = missions.data ?? [];
  const V = vehicles.data ?? [];
  const drName = (c: string | null) => drivers.data?.find((d) => d.code === c)?.name ?? c ?? '—';

  const shown = useMemo(
    () => (filter === 'actives'
      ? MI.filter((m) => m.status === 'EN_COURS' || m.status === 'PLANIFIEE')
      : MI).filter((m) => period.mode === 'cumul' || period.matches(m.dateStart)),
    [MI, filter, period],
  );

  const est = positions.data ?? [];
  const km = shown.reduce((s, m) => s + (m.distance ?? 0), 0);

  const search = async () => {
    if (!loc.trim()) return;
    const res = await nearest.mutateAsync({ location: loc.trim(), limit: 6 });
    setNearestRes(res);
  };

  return (
    <div className="page active">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}><PeriodPicker period={period} /></div>
      <div className="sg" style={{ marginBottom: 12 }}>
        <div className="sc"><div><div className="sv">{shown.length}</div><div className="sl">Missions</div></div><div className="si bl">{icons.truck}</div></div>
        <div className="sc"><div><div className="sv">{est.length}</div><div className="sl">Véhicules en route (estimé)</div></div><div className="si tl">{icons.pin}</div></div>
        <div className="sc"><div><div className="sv">{new Set(shown.map((m) => m.driverCode)).size}</div><div className="sl">Chauffeurs</div></div><div className="si am">{icons.users}</div></div>
        <div className="sc"><div><div className="sv">{fk(km)}</div><div className="sl">Km Total</div></div><div className="si gn">{icons.activity}</div></div>
      </div>

      <div className="cr" style={{ marginBottom: 12 }}>
        <div className="cc">
          <h3>Trouver le véhicule le plus proche</h3>
          <div className="sub">On cherche à récupérer un truc rapide — évite d&apos;envoyer un chauffeur pour rien.</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <div style={{ flex: 1 }}>
              <CityInput value={loc} onChange={setLoc} onCommit={() => search()} placeholder="Commune, rue ou adresse précise…" />
            </div>
            <button className="btn btn-p" onClick={search} disabled={nearest.isPending}>Chercher</button>
          </div>
          {nearestRes && (
            <div className="tw" style={{ marginTop: 8 }}>
              <table>
                <thead><tr><th>#</th><th>Véhicule</th><th>Type</th><th>Statut</th><th>Position</th><th>Distance</th><th>ETA</th></tr></thead>
                <tbody>
                  {nearestRes.map((r, i) => (
                    <tr key={r.vehicleCode}>
                      <td>{i + 1}</td>
                      <td style={{ fontWeight: 600 }}>{r.vehicleCode} — {r.label}</td>
                      <td>{r.type}</td>
                      <td><span className="bg bg-t">{r.status}</span></td>
                      <td style={{ fontSize: '.72rem', color: 'var(--tm)' }}>{r.positionSource === 'mission' ? `en mission ${r.missionNum}` : 'dépôt'}</td>
                      <td style={{ fontWeight: 600 }}>{fk(r.distanceKm)} km</td>
                      <td>{r.etaMin} min</td>
                    </tr>
                  ))}
                  {!nearestRes.length && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--tm)', padding: 12 }}>Lieu non reconnu</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="cc">
          <h3>Positions estimées (statique)</h3>
          <div className="sub">Calcul : heure départ + distance + vitesse GPS autorisée → position théorique actuelle.</div>
          <div className="tw" style={{ marginTop: 8 }}>
            <table>
              <thead><tr><th>Mission</th><th>Véhicule</th><th>Trajet</th><th>Avancement</th><th>ETA</th></tr></thead>
              <tbody>
                {est.map((e) => (
                  <tr key={e.missionNum}>
                    <td>{e.missionNum}</td><td>{e.vehicleCode}</td>
                    <td style={{ fontSize: '.72rem' }}>{e.from} → {e.to}</td>
                    <td>
                      <div className="pb" style={{ width: 60, display: 'inline-block' }}><div className="pf" style={{ width: `${Math.round(e.pctDone * 100)}%`, background: e.pctDone >= 1 ? 'var(--g5)' : 'var(--b5)' }} /></div>
                      {' '}{Math.round(e.pctDone * 100)}% ({fk(e.distanceCoveredKm)}/{fk(e.distanceTotalKm)} km)
                    </td>
                    <td>{e.pctDone >= 1 ? 'arrivé' : `${e.etaMin} min`}</td>
                  </tr>
                ))}
                {!est.length && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--tm)', padding: 12 }}>Aucune mission en cours</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="fb" style={{ marginBottom: 10 }}>
        <button className={`fc${filter === 'actives' ? ' act' : ''}`} onClick={() => setFilter('actives')}>Missions actives</button>
        <button className={`fc${filter === 'all' ? ' act' : ''}`} onClick={() => setFilter('all')}>Toutes</button>
        <div style={{ flex: 1 }} />
        <div className="lg">
          <div className="li"><span className="ld" style={{ background: '#16a34a' }} />En cours (position estimée)</div>
          <div className="li"><span className="ld" style={{ background: '#2563eb' }} />Planifiée</div>
        </div>
      </div>

      <div className="cc" style={{ padding: 0, overflow: 'hidden' }}>
        <FleetMap missions={shown} vehicles={V} estimated={est} drName={drName} />
      </div>
    </div>
  );
}
