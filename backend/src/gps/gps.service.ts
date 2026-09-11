import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mission } from '../missions/missions.entity';
import { Vehicle } from '../vehicles/vehicles.entity';
import { AppConfigService } from '../app-config/app-config.service';
import { dzGeo, gpsMatrix } from '../common/dz-geo';

function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
function normCity(name: string, keys: string[]): string | null {
  const sl = (name || '').trim().toLowerCase();
  let best: string | null = null;
  let bestLen = 0;
  for (const k of keys) {
    const kl = k.toLowerCase();
    if (sl === kl) return k;
    if (sl.includes(kl) && kl.length > bestLen) { best = k; bestLen = kl.length; }
  }
  return best;
}
function coordOf(name: string | null | undefined): { lat: number; lon: number } | null {
  if (!name) return null;
  const k = normCity(name, Object.keys(dzGeo));
  return k ? dzGeo[k] : null;
}
function roadDistance(a: string, b: string): number | null {
  const ka = normCity(a, Object.keys(gpsMatrix));
  const kb = normCity(b, Object.keys(gpsMatrix));
  if (ka && kb && gpsMatrix[ka]?.[kb] != null) return gpsMatrix[ka][kb];
  if (ka && kb && gpsMatrix[kb]?.[ka] != null) return gpsMatrix[kb][ka];
  const ca = coordOf(a); const cb = coordOf(b);
  return ca && cb ? Math.round(haversine(ca, cb) * 1.3) : null;
}

const DEPOT = { name: 'Alger', ...(dzGeo['Alger'] ?? { lat: 36.75, lon: 3.06 }) };

export interface EstimatedPosition {
  missionNum: string;
  vehicleCode: string | null;
  driverCode: string | null;
  from: string;
  to: string;
  status: string | null;
  lat: number;
  lon: number;
  pctDone: number;      // 0..1
  elapsedMin: number;
  etaMin: number | null;
  distanceCoveredKm: number;
  distanceTotalKm: number;
  speedKmh: number;
  estimatedAt: string;
}

@Injectable()
export class GpsService {
  constructor(
    @InjectRepository(Mission) private readonly missions: Repository<Mission>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    private readonly config: AppConfigService,
  ) {}

  private async speed(): Promise<number> {
    const params = ((await this.config.get('PARAMS')) as { vitMoy?: number }) ?? {};
    return params.vitMoy && params.vitMoy > 0 ? params.vitMoy : 80;
  }

  /** Position estimee d'un vehicule selon l'heure de depart, la distance et la vitesse GPS autorisee. */
  async estimate(m: Mission, speedKmh: number): Promise<EstimatedPosition | null> {
    const fromLoc = m.fromLoc ?? '';
    const toLoc = m.toLoc ?? '';
    const c1 = coordOf(fromLoc);
    const c2 = coordOf(toLoc);
    if (!c1 || !c2) return null;
    const now = new Date();
    const total = m.distance ?? roadDistance(fromLoc, toLoc) ?? haversine(c1, c2);
    const tripMin = total > 0 ? (total / speedKmh) * 60 : 60;

    // Heure de depart reelle : `startedAt` (mission demarree par le chauffeur / bureau) prioritaire,
    // sinon l'horaire planifie. Retour DG : une mission demarree doit montrer un avancement.
    let dep: Date | null = m.startedAt
      ? new Date(m.startedAt)
      : m.dateStart
        ? new Date(`${m.dateStart}T${m.timeStart || '07:00'}`)
        : null;
    // Mission EN_COURS dont l'horaire theorique est dans le futur (donnees de demo recalees) :
    // on l'ancre sur « maintenant » en supposant ~40 % du trajet deja parcouru.
    if (m.status === 'EN_COURS' && (!dep || dep.getTime() > now.getTime())) {
      dep = new Date(now.getTime() - tripMin * 0.4 * 60000);
    }
    // Fin reelle (mission terminee) : borne le temps ecoule.
    const end = m.finishedAt ? new Date(m.finishedAt) : null;
    const ref = end && end.getTime() < now.getTime() ? end : now;
    const elapsedMin = dep ? Math.max(0, (ref.getTime() - dep.getTime()) / 60000) : 0;
    const covered = Math.min(total, (elapsedMin / 60) * speedKmh);
    const pct = total > 0 ? covered / total : 0;
    // interpolation lineaire le long du segment (statique)
    const lat = c1.lat + (c2.lat - c1.lat) * pct;
    const lon = c1.lon + (c2.lon - c1.lon) * pct;
    const remaining = Math.max(0, total - covered);
    return {
      missionNum: m.num,
      vehicleCode: m.vehicleCode,
      driverCode: m.driverCode,
      from: fromLoc,
      to: toLoc,
      status: m.status,
      lat: +lat.toFixed(5),
      lon: +lon.toFixed(5),
      pctDone: +pct.toFixed(3),
      elapsedMin: Math.round(elapsedMin),
      etaMin: pct >= 1 ? 0 : Math.round((remaining / speedKmh) * 60),
      distanceCoveredKm: Math.round(covered),
      distanceTotalKm: Math.round(total),
      speedKmh,
      estimatedAt: now.toISOString(),
    };
  }

  /** Positions estimees de toutes les missions en cours (ou planifiees si demande). */
  async positions(includePlanned = false): Promise<EstimatedPosition[]> {
    const speed = await this.speed();
    const statuses = includePlanned ? ['EN_COURS', 'PLANIFIEE'] : ['EN_COURS'];
    const list = (await this.missions.find()).filter((m) => statuses.includes(m.status ?? ''));
    const out: EstimatedPosition[] = [];
    for (const m of list) {
      const e = await this.estimate(m, speed);
      if (e) out.push(e);
    }
    return out;
  }

  /** Vehicule le plus proche d'un lieu donne (position estimee si en mission, sinon depot). */
  async nearest(location: string, limit = 5): Promise<Array<{
    vehicleCode: string; label: string; type: string | null; status: string | null;
    positionSource: 'mission' | 'depot'; distanceKm: number; etaMin: number; missionNum?: string;
  }>> {
    const target = coordOf(location);
    if (!target) return [];
    const speed = await this.speed();
    const vehicles = await this.vehicles.find();
    const activePositions = await this.positions(false);
    const byVehicle = new Map(activePositions.map((p) => [p.vehicleCode, p]));

    const rows = vehicles
      .filter((v) => v.status !== 'HORS_SERVICE' && v.status !== 'EN_PANNE')
      .map((v) => {
        const pos = byVehicle.get(v.code);
        const from = pos ? { lat: pos.lat, lon: pos.lon } : DEPOT;
        const d = Math.round(haversine(from, target) * 1.3);
        return {
          vehicleCode: v.code,
          label: `${v.brand ?? ''} ${v.model ?? ''}`.trim(),
          type: v.type,
          status: v.status,
          positionSource: (pos ? 'mission' : 'depot') as 'mission' | 'depot',
          distanceKm: d,
          etaMin: Math.round((d / speed) * 60),
          ...(pos ? { missionNum: pos.missionNum } : {}),
        };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit);
    return rows;
  }
}
