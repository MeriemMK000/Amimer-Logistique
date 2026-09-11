// Portage v8 runSelection — moteur d'affectation pondéré.
import type { Driver, Vehicle } from '../types';

export interface Weights { fat: number; hrs: number; qual: number; km: number; doc: number; conso: number }
export interface SelectionParams { type: string; cargo: string; weights: Weights }

export function runSelection(
  drivers: Driver[], vehicles: Vehicle[], { type, cargo, weights }: SelectionParams,
): { drivers: { d: Driver; sc: number }[]; vehicles: { v: Vehicle; sc: number }[] } {
  const { fat: wF, hrs: wH, qual: wQ, km: wK, doc: wD, conso: wC } = weights;
  const totalW = wF + wH + wQ + wK + wD + wC || 1;
  const reqLic = type === 'LOURD' || type === 'ENGIN' ? ['C', 'C+E'] : ['B', 'C', 'C+E', 'D'];

  const drS = drivers
    .filter((d) => (d.status === 'DISPONIBLE' || d.status === 'EN_REPOS') && reqLic.includes(d.license))
    .map((d) => {
      let sc = 100;
      if (wF) sc -= (d.fatigue ?? 0) * (wF / totalW) * 100;
      if (wH) sc -= ((d.hoursWeek ?? 0) / 48) * (wH / totalW) * 100;
      if (wQ) {
        if (cargo === 'ADR (mat. dangereuses)' && d.quals?.includes('ADR')) sc += (wQ / totalW) * 50;
        else if (cargo === 'Frigorifique' && d.quals?.includes('Frigo')) sc += (wQ / totalW) * 50;
        else if (cargo !== 'Non') sc -= (wQ / totalW) * 80;
      }
      if ((d.hoursWeek ?? 0) >= 45) sc -= 20;
      return { d, sc: Math.max(0, Math.min(100, Math.round(sc))) };
    })
    .sort((a, b) => b.sc - a.sc);

  const vhS = vehicles
    .filter((v) => v.status === 'DISPONIBLE' && v.type === type)
    .map((v) => {
      let sc = 100;
      if (wK) sc -= ((v.km ?? 0) / 500_000) * (wK / totalW) * 100;
      if (wD && (v.ctStatus === 'EXPIRE' || v.insStatus === 'EXPIRE')) sc -= (wD / totalW) * 100;
      if (v.ownership === 'PROPRE') sc += 3;
      return { v, sc: Math.max(0, Math.min(100, Math.round(sc))) };
    })
    .sort((a, b) => b.sc - a.sc);

  return { drivers: drS, vehicles: vhS };
}
