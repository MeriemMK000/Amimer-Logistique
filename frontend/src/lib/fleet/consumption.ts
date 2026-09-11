// Portage verbatim de v8 : vhMissionKm, detection surconsommation.
import type { FuelEntry, Mission, Vehicle } from '../types';

/** v8: const vhMissionKm=c=>MI.filter(m=>m.vh===c && statut in [TERMINEE,CLOTUREE,EN_COURS]).reduce(+d) */
export function vhMissionKm(code: string, missions: Mission[]): number {
  return missions
    .filter((m) => m.vehicleCode === code && ['TERMINEE', 'CLOTUREE', 'EN_COURS'].includes(m.status))
    .reduce((s, m) => s + (m.distance ?? 0), 0);
}

/** Consommation reelle L/100km d'un vehicule sur la periode des donnees. */
export function realConsumption(code: string, missions: Mission[], fuel: FuelEntry[]): number | null {
  const vFu = fuel.filter((f) => f.vehicleCode === code);
  if (!vFu.length) return null;
  const tkm = vhMissionKm(code, missions);
  const tl = vFu.reduce((s, f) => s + f.qty, 0);
  if (tkm <= 0) return null;
  return (tl / tkm) * 100;
}

/** v8 rDashKPI : nombre de vehicules dont la conso reelle depasse la norme corrigee de +15 %. */
export function surconsoVehicles(vehicles: Vehicle[], missions: Mission[], fuel: FuelEntry[]): Vehicle[] {
  return vehicles
    .filter((v) => (v.normOff ?? 0) > 0)
    .filter((v) => {
      const rc = realConsumption(v.code, missions, fuel);
      return rc != null && rc > (v.normCorr ?? 0) * 1.15;
    });
}

export interface VerRow { vh: string; b: string; kmMis: number; l: number; no: number; resDeb: number; resFin: number }

/** v8 buildVER — dérivé de MI + FU. */
export function buildVER(vehicles: Vehicle[], missions: Mission[], fuel: FuelEntry[]): VerRow[] {
  const set = [...new Set([...missions.map((m) => m.vehicleCode), ...fuel.map((f) => f.vehicleCode)])];
  const rows: VerRow[] = [];
  for (const vh of set) {
    const v = vehicles.find((x) => x.code === vh);
    if (!v || v.type === 'ENGIN' || v.type === 'REMORQUE' || !v.normOff || v.fuel === '—' || !vh) continue;
    const kmMis = vhMissionKm(vh, missions);
    const vhFu = fuel.filter((f) => f.vehicleCode === vh);
    const l = vhFu.reduce((s, f) => s + f.qty, 0);
    if (kmMis === 0 && l === 0) continue;
    const resDeb = vhFu.length ? Math.round(l * 0.15) : 0;
    const resFin = vhFu.length ? Math.round(l * 0.18) : 0;
    rows.push({ vh, b: `${v.brand} ${v.model}`, kmMis, l, no: v.normCorr ?? 0, resDeb, resFin });
  }
  return rows;
}
