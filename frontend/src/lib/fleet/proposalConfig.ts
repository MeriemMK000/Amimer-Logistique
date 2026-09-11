// Retour DG : configuration centrale de l'algorithme de proposition véhicule + chauffeur.
// Éditée dans Paramètres › Sélection automatique, stockée sous la clé AppConfig
// « PROPOSAL_CONFIG », lue par la modale mission ET l'onglet Planification.
import type { ProposalConfig } from '@/lib/types';

export interface ProposalWeightRow {
  key: string;
  label: string;
  hint: string;
  def: number;
  on: boolean;
  /** utilisé par le score véhicule (sinon score chauffeur). */
  scope: 'chauffeur' | 'vehicule';
}

export const PROPOSAL_WEIGHT_ROWS: ProposalWeightRow[] = [
  { key: 'fat', label: 'Indice de fatigue', hint: 'Chauffeur reposé privilégié', def: 35, on: true, scope: 'chauffeur' },
  { key: 'hrs', label: 'Charge horaire / semaine', hint: 'Équilibrage des heures travaillées + missions', def: 20, on: true, scope: 'chauffeur' },
  { key: 'qual', label: 'Qualification requise', hint: 'ADR, frigo, citerne… selon la mission', def: 20, on: true, scope: 'chauffeur' },
  { key: 'dedicated', label: 'Chauffeur dédié', hint: 'Rattaché à une direction / BU pour missions sensibles', def: 20, on: true, scope: 'chauffeur' },
  { key: 'doc', label: 'Validité des documents', hint: 'Permis / visite technique / assurance à jour', def: 10, on: true, scope: 'chauffeur' },
  { key: 'km', label: 'Kilométrage véhicule', hint: 'Véhicule le moins usé privilégié', def: 15, on: true, scope: 'vehicule' },
  { key: 'conso', label: 'Efficacité carburant', hint: 'Véhicule le plus sobre (option)', def: 10, on: false, scope: 'vehicule' },
];

export const PROPOSAL_DEFAULT: ProposalConfig = {
  weights: Object.fromEntries(PROPOSAL_WEIGHT_ROWS.map((r) => [r.key, r.def])),
  enabled: Object.fromEntries(PROPOSAL_WEIGHT_ROWS.map((r) => [r.key, r.on])),
};

/** Normalise une config partielle (venant de l'API) vers une config complète. */
export function normalizeProposalConfig(raw: Partial<ProposalConfig> | null | undefined): ProposalConfig {
  return {
    weights: { ...PROPOSAL_DEFAULT.weights, ...(raw?.weights ?? {}) },
    enabled: { ...PROPOSAL_DEFAULT.enabled, ...(raw?.enabled ?? {}) },
  };
}

/** Poids effectifs (poids décoché → 0), prêts à envoyer au backend / au moteur local. */
export function effectiveWeights(cfg: ProposalConfig): Record<string, number> {
  return Object.fromEntries(
    PROPOSAL_WEIGHT_ROWS.map((r) => [r.key, cfg.enabled[r.key] === false ? 0 : (cfg.weights[r.key] ?? 0)]),
  );
}
