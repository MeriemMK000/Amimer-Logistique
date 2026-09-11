// Portage v8 : calcMissionHours, getMargeForVh, calcMissionCoutInterne, fuDateToISO.
import type { Driver, EngineFuelEntry, FuelEntry, LeaseContract, MargeType, Mission, Vehicle } from '../types';
import { calcFraisMission, type BaremeMission } from './bareme';
import { vehicleCostModel, driverCostModel } from './vehicleCost';

export function calcMissionHours(m: Mission): number {
  const d1 = new Date(`${m.dateStart}T${m.timeStart || '07:00'}`);
  const d2 = m.dateEnd ? new Date(`${m.dateEnd}T${m.timeEnd || '17:00'}`) : new Date(NaN);
  const h = (d2.getTime() - d1.getTime()) / 3_600_000;
  if (Number.isFinite(h) && h > 0) return h;
  // Estimation si la fin n'est pas renseignée : trajet à ~55 km/h + 1 h sur place (min 4 h).
  const km = m.distance ?? 0;
  return km > 0 ? Math.max(4, Math.round((km / 55 + 1) * 10) / 10) : 8;
}

export function fuDateToISO(dt: string | null | undefined): string {
  if (!dt) return '';
  const parts = dt.split('/');
  if (parts.length === 2) return `2026-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  return dt;
}

export type MargeMode = 'global' | 'type' | 'vehicule';

export function getMargeForVh(
  vhCode: string | null, vehicles: Vehicle[], mode: MargeMode, margePct: number, margeType: MargeType,
): number {
  const vh = vehicles.find((v) => v.code === vhCode);
  if (mode === 'vehicule' && vh && typeof vh.margePct === 'number') return vh.margePct;
  if ((mode === 'vehicule' || mode === 'type') && vh && margeType[vh.type] !== undefined) return margeType[vh.type];
  return margePct || 0;
}

export interface MissionCost {
  hours: number; coutVh: number; fuelCost: number; coutDr: number; fraisMission: number;
  totalCouts: number; margePct: number; prixCession: number;
  vhLabel: string; drLabel: string; buCode: string; caCode: string; vhType: string;
}

/**
 * Répartition d'une mission entre BU/structures (retour DG — missions groupant plusieurs
 * demandes de prise en charge). Sans `costSplit` → 100 % à `m.bu`.
 */
export interface BuShare { bu: string; structure: string | null; pct: number; totalCouts: number; prixCession: number; fraisMission: number; dpcCode?: string }
export function missionBuShares(m: Mission, c: MissionCost): BuShare[] {
  const split = m.costSplit ?? [];
  if (split.length < 2) {
    return [{ bu: m.bu ?? '—', structure: null, pct: 100, totalCouts: c.totalCouts, prixCession: c.prixCession, fraisMission: c.fraisMission }];
  }
  return split.map((s) => ({
    bu: s.bu ?? m.bu ?? '—', structure: s.structure ?? null, pct: s.sharePct, dpcCode: s.dpcCode,
    totalCouts: Math.round(c.totalCouts * s.sharePct / 100),
    prixCession: Math.round(c.prixCession * s.sharePct / 100),
    fraisMission: Math.round(c.fraisMission * s.sharePct / 100),
  }));
}

export function calcMissionCoutInterne(
  m: Mission, vehicles: Vehicle[], drivers: Driver[], fuel: FuelEntry[], engineFuel: EngineFuelEntry[],
  bareme: BaremeMission, mode: MargeMode, margePct: number, margeType: MargeType,
  contracts: LeaseContract[] = [], joursOuvres = 22,
): MissionCost {
  const hours = calcMissionHours(m);
  const vh = vehicles.find((v) => v.code === m.vehicleCode);
  const dr = drivers.find((d) => d.code === m.driverCode);
  // Retour DG : coût véhicule cohérent — loué → prix contrat, propre → coût de possession.
  const ct = contracts.find((c) => c.vehicleCode === m.vehicleCode) ?? null;
  const coutVh = Math.round(hours * vehicleCostModel(vh, ct, joursOuvres).hourly);
  // Retour DG : coût du chauffeur = son coût journalier 8 h (sinon horaire) — facture les heures.
  const coutDr = Math.round(hours * driverCostModel(dr).hourly);
  const fraisMission = calcFraisMission(m, bareme, vehicles).total || 0;
  let fuelCost = 0;
  const inRange = (dt: string | null | undefined) => {
    const f = fuDateToISO(dt);
    return f >= (m.dateStart ?? '') && f <= (m.dateEnd ?? '');
  };
  fuel.forEach((f) => { if (f.vehicleCode === m.vehicleCode && inRange(f.date)) fuelCost += f.qty * f.unitPrice; });
  engineFuel.forEach((f) => { if (f.vehicleCode === m.vehicleCode && inRange(f.date)) fuelCost += f.qty * f.unitPrice; });
  fuelCost = Math.round(fuelCost);
  const totalCouts = coutVh + fuelCost + coutDr + fraisMission;
  const marge = getMargeForVh(m.vehicleCode, vehicles, mode, margePct, margeType);
  return {
    hours, coutVh, fuelCost, coutDr, fraisMission, totalCouts,
    margePct: marge, prixCession: Math.round(totalCouts * (1 + marge / 100)),
    vhLabel: vh ? `${vh.code} ${vh.brand} ${vh.model}` : m.vehicleCode ?? '',
    drLabel: dr?.name ?? m.driverCode ?? '', buCode: m.bu ?? '', caCode: m.ca ?? '', vhType: vh?.type ?? '',
  };
}
