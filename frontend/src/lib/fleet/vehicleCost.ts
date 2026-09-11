// Retour DG : « on n'a pas défini un cas où on récupère le coût du véhicule propre pas le
// véhicule loué ». Ce helper donne UN modèle de coût cohérent pour tout véhicule, quelle
// que soit la propriété, utilisé partout (coût mission, Synthèse par Site, Voitures de service).
import type { Driver, LeaseContract, Vehicle } from '../types';

export type CostBasis =
  | 'contrat_location'   // véhicule loué, prix/jour du contrat
  | 'cout_location'      // véhicule loué sans contrat, coût mensuel saisi
  | 'cout_jour_8h'       // véhicule propre, coût quotidien 8h saisi (prioritaire)
  | 'cout_possession'    // véhicule propre, coût de possession mensuel saisi
  | 'cout_horaire'       // fallback : coût horaire saisi en fiche
  | 'indefini';          // aucun coût défini → 0

export interface VehicleCostModel {
  monthly: number;
  daily: number;
  hourly: number;
  basis: CostBasis;
  /** true si aucun coût n'est défini pour ce véhicule (à signaler). */
  undefinedCost: boolean;
}

const BASIS_LABEL: Record<CostBasis, string> = {
  contrat_location: 'Contrat de location (prix/jour)',
  cout_location: 'Coût de location mensuel',
  cout_jour_8h: 'Coût quotidien (journée 8 h)',
  cout_possession: 'Coût de possession mensuel',
  cout_horaire: 'Coût horaire (fiche véhicule)',
  indefini: 'Non défini',
};
export const costBasisLabel = (b: CostBasis) => BASIS_LABEL[b];

/**
 * @param joursOuvres jours ouvrés par mois (config PARAMS.joursOuvresMois, défaut 22)
 */
export function vehicleCostModel(
  vh: Vehicle | null | undefined,
  contract?: LeaseContract | null,
  joursOuvres = 22,
): VehicleCostModel {
  const jo = joursOuvres > 0 ? joursOuvres : 22;
  const fromMonthly = (monthly: number, basis: CostBasis): VehicleCostModel => {
    const daily = Math.round(monthly / jo);
    return { monthly: Math.round(monthly), daily, hourly: Math.round(daily / 8), basis, undefinedCost: false };
  };
  const fromDaily = (daily: number, basis: CostBasis): VehicleCostModel => ({
    monthly: Math.round(daily * jo), daily: Math.round(daily), hourly: Math.round(daily / 8), basis, undefinedCost: false,
  });

  const isLoc = (vh?.ownership ?? '').toUpperCase() === 'LOCATION';

  if (isLoc && contract?.dailyPrice) return fromDaily(contract.dailyPrice, 'contrat_location');
  if (isLoc && vh?.leaseCost) return fromMonthly(vh.leaseCost, 'cout_location');
  // Véhicule PROPRE : coût quotidien 8 h prioritaire (retour DG), sinon coût mensuel.
  if (!isLoc && vh?.ownedDailyCost) return fromDaily(vh.ownedDailyCost, 'cout_jour_8h');
  if (!isLoc && vh?.ownedMonthlyCost) return fromMonthly(vh.ownedMonthlyCost, 'cout_possession');
  if (vh?.hourlyCost) {
    const hourly = Math.round(vh.hourlyCost);
    return { monthly: hourly * 8 * jo, daily: hourly * 8, hourly, basis: 'cout_horaire', undefinedCost: false };
  }
  return { monthly: 0, daily: 0, hourly: 0, basis: 'indefini', undefinedCost: true };
}

// ── Coût du CHAUFFEUR (retour DG : sert à facturer les heures) ──────────────────
export interface DriverCostModel { hourly: number; daily: number; basis: 'cout_jour_8h' | 'cout_horaire' | 'indefini'; undefinedCost: boolean }

/** Coût d'un chauffeur : coût journalier 8 h prioritaire, sinon coût horaire × 8. */
export function driverCostModel(dr: Driver | null | undefined): DriverCostModel {
  if (dr?.dailyCost) {
    const daily = Math.round(dr.dailyCost);
    return { hourly: Math.round(daily / 8), daily, basis: 'cout_jour_8h', undefinedCost: false };
  }
  if (dr?.hourlyCost) {
    const hourly = Math.round(dr.hourlyCost);
    return { hourly, daily: hourly * 8, basis: 'cout_horaire', undefinedCost: false };
  }
  return { hourly: 0, daily: 0, basis: 'indefini', undefinedCost: true };
}
