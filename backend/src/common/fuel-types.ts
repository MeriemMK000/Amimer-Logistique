/**
 * Types de carburant canoniques (retour DG : le bilan doit être ventilé PAR TYPE).
 * Un manque de gasoil ne se compense pas avec un excédent d'essence.
 */
export type FuelType = 'GASOIL' | 'SP' | 'SUPER' | 'GPL';

export const FUEL_TYPES: FuelType[] = ['GASOIL', 'SP', 'SUPER', 'GPL'];

export const FUEL_LABEL: Record<FuelType, string> = {
  GASOIL: 'Gasoil',
  SP: 'Essence sans plomb',
  SUPER: 'Essence super',
  GPL: 'GPL',
};

/** Normalise (fuelType, grade) — venus du véhicule ou du plein — vers un type canonique. */
export function canonFuel(fuelType?: string | null, grade?: string | null): FuelType {
  const t = (fuelType ?? '').trim().toUpperCase();
  const g = (grade ?? '').trim().toUpperCase();
  if (t === 'GPL') return 'GPL';
  if (t === 'SP' || t === 'SANS PLOMB' || t === 'SANS-PLOMB') return 'SP';
  if (t === 'SUPER') return 'SUPER';
  if (t === 'ESSENCE' || t === 'ESS') return g === 'SUPER' ? 'SUPER' : 'SP';
  // GASOIL / DIESEL / GAS-OIL / GO / vide → gasoil
  return 'GASOIL';
}

/** Prix courant d'un type de carburant depuis la config FUEL_PRICES (avec repli ESSENCE). */
export function fuelPrice(prices: Record<string, number> | null | undefined, ft: FuelType): number | null {
  const p = prices ?? {};
  if (ft === 'SP') return p.SP ?? p.ESSENCE ?? null;
  if (ft === 'SUPER') return p.SUPER ?? p.ESSENCE ?? null;
  const v = p[ft];
  return v != null ? v : null;
}

/** Sous-type essence ('SP'|'SUPER') pour la colonne `grade`, ou null (gasoil / GPL). */
export function gradeOf(ft: FuelType): 'SP' | 'SUPER' | null {
  return ft === 'SP' || ft === 'SUPER' ? ft : null;
}
