// Portage verbatim de v8 : getZoneBareme, getCatBareme, getBaremeFor, calcFraisMission.
import { fk } from './format';
import type { Vehicle } from '../types';

export interface BaremeGrid {
  repas: number; nuitee: number; petitDej: number; km: number;
  suppZone: number; pauseCafe: number; plafondJour: number;
}
export interface BaremeMission {
  grille: Record<'LEGER' | 'LOURD', Record<'NORD' | 'SUD', BaremeGrid>>;
  indemnites: { couchage: number; salissure: number; risque: number; weekend: number };
}

export const getZoneBareme = (zone: string | null | undefined) => (zone === 'Sud' ? 'SUD' : 'NORD');

export function getCatBareme(vehicleCode: string | null | undefined, vehicles: Vehicle[]) {
  const v = vehicles.find((x) => x.code === vehicleCode);
  if (!v) return 'LEGER';
  return v.type === 'LOURD' || v.type === 'ENGIN' || v.type === 'REMORQUE' ? 'LOURD' : 'LEGER';
}

export function getBaremeFor(
  m: { vehicleCode?: string | null; zone?: string | null },
  bareme: BaremeMission,
  vehicles: Vehicle[],
) {
  const cat = getCatBareme(m.vehicleCode, vehicles);
  const zb = getZoneBareme(m.zone);
  return { ...bareme.grille[cat][zb], cat, zb };
}

export interface FraisLine { label: string; detail: string; montant: number }
export interface FraisResult {
  lines: FraisLine[]; total: number; plafonnement: number;
  nbJours: number; nbNuits: number; nbWeekend: number; diffH: number;
  cat: string; zoneBareme: string; confirmed: boolean;
}

interface MissionLike {
  dateStart?: string | null; timeStart?: string | null;
  dateEnd?: string | null; timeEnd?: string | null;
  distance?: number | null; zone?: string | null;
  vehicleCode?: string | null; status?: string; closed?: boolean | null;
}

/** v8 calcFraisMission — logique identique. */
export function calcFraisMission(m: MissionLike, bareme: BaremeMission, vehicles: Vehicle[]): FraisResult {
  const b = getBaremeFor(m, bareme, vehicles);
  const ind = bareme.indemnites;
  const d1 = new Date(`${m.dateStart ?? '2026-08-28'}T${m.timeStart || '07:00'}`);
  const d2 = new Date(`${m.dateEnd ?? '2026-08-28'}T${m.timeEnd || '17:00'}`);
  const diffH = Math.max(0, (d2.getTime() - d1.getTime()) / 3_600_000);
  const nbJours = Math.ceil(diffH / 24) || 1;
  const nbNuits = Math.max(0, nbJours - 1);
  let nbRepas = 0;
  if (diffH > 10) nbRepas = 2 * nbJours;
  else if (diffH > 5) nbRepas = nbJours;
  const nbPetitDej = nbNuits;
  const nbPauseCafe = nbJours;
  const dist = m.distance ?? 0;
  const indKm = Math.round(dist * b.km);
  const suppZone = (b.suppZone || 0) * nbJours;
  let nbWeekend = 0;
  for (let i = 0; i < nbJours; i++) {
    const dt = new Date(d1);
    dt.setDate(dt.getDate() + i);
    const dow = dt.getDay();
    if (dow === 0 || dow === 6) nbWeekend++;
  }
  const lines: FraisLine[] = [];
  lines.push({ label: 'Indemnité kilométrique', detail: `${dist} km × ${b.km} DA`, montant: indKm });
  lines.push({ label: 'Repas', detail: `${nbRepas} repas × ${fk(b.repas)} DA`, montant: nbRepas * b.repas });
  if (nbNuits > 0) lines.push({ label: 'Nuitées', detail: `${nbNuits} nuit${nbNuits > 1 ? 's' : ''} × ${fk(b.nuitee)} DA`, montant: nbNuits * b.nuitee });
  if (nbPetitDej > 0) lines.push({ label: 'Petit-déjeuner', detail: `${nbPetitDej} × ${fk(b.petitDej)} DA`, montant: nbPetitDej * b.petitDej });
  lines.push({ label: 'Pause café / collation', detail: `${nbPauseCafe} × ${fk(b.pauseCafe)} DA`, montant: nbPauseCafe * b.pauseCafe });
  if (suppZone > 0) lines.push({ label: `Supplément zone ${m.zone} (${b.zb})`, detail: `${nbJours} jour${nbJours > 1 ? 's' : ''} × ${fk(b.suppZone)} DA`, montant: suppZone });
  if (nbWeekend > 0 && ind.weekend > 0) lines.push({ label: 'Supplément week-end/férié', detail: `${nbWeekend} jour${nbWeekend > 1 ? 's' : ''} × ${fk(ind.weekend)} DA`, montant: nbWeekend * ind.weekend });
  if (nbNuits > 0 && ind.couchage > 0) lines.push({ label: 'Prime couchage', detail: `${nbNuits} nuit${nbNuits > 1 ? 's' : ''} × ${fk(ind.couchage)} DA`, montant: nbNuits * ind.couchage });
  if (b.cat === 'LOURD' && ind.salissure > 0) lines.push({ label: 'Prime salissure (lourd)', detail: `${nbJours} jour${nbJours > 1 ? 's' : ''} × ${fk(ind.salissure)} DA`, montant: nbJours * ind.salissure });
  let total = lines.reduce((s, l) => s + l.montant, 0);
  let plafonnement = 0;
  if (b.plafondJour > 0) {
    const cap = b.plafondJour * nbJours;
    if (total > cap) { plafonnement = total - cap; total = cap; }
  }
  return {
    lines, total, plafonnement, nbJours, nbNuits, nbWeekend, diffH,
    cat: b.cat, zoneBareme: b.zb, confirmed: m.status === 'CLOTUREE' || m.closed === true,
  };
}
