'use client';

import { useMemo } from 'react';
import { useBusinessUnits } from '@/lib/api/hooks';

/**
 * Listes de choix « Structure » et « Responsable » alimentées par le référentiel
 * `business_units` (Paramètres › Business Units) — retour DG : plus de saisie libre,
 * la structure et son responsable sortent toujours de l'organigramme.
 */
export function useOrgOptions() {
  const bus = useBusinessUnits();
  return useMemo(() => {
    const list = bus.data ?? [];
    const structures = list
      .map((b) => b.name)
      .filter((n): n is string => !!n && n.trim().length > 0)
      .sort((a, b) => a.localeCompare(b, 'fr'));
    const managers = [
      ...new Set(list.map((b) => b.manager?.name?.trim()).filter((n): n is string => !!n)),
    ].sort((a, b) => a.localeCompare(b, 'fr'));
    const byName = (structure: string | null | undefined) =>
      list.find((b) => b.name === (structure ?? '').trim());
    return {
      structures,
      managers,
      loaded: !!bus.data,
      /** Responsable de la structure choisie (nom), ou '' si aucun / inconnu. */
      managerFor: (structure: string | null | undefined) => byName(structure)?.manager?.name?.trim() ?? '',
      /** Code BU de la structure choisie, ou '' si inconnue. */
      codeFor: (structure: string | null | undefined) => byName(structure)?.code ?? '',
    };
  }, [bus.data]);
}

/** Garde la valeur courante en tête de liste même si elle ne figure plus dans le référentiel. */
export function withCurrentOrg(list: string[], current: unknown): string[] {
  const c = current == null ? '' : String(current).trim();
  return c && !list.includes(c) ? [c, ...list] : list;
}
