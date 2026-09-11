'use client';

import { useMemo } from 'react';
import { useConfig, useExternalVehicles, useVehicleAssignments, useVehicles } from '@/lib/api/hooks';

const COMBINING = /[̀-ͯ]/g;
const norm = (s: string) => s.normalize('NFD').replace(COMBINING, '').toLowerCase().trim();

/** Nettoie une liste de sites : trim, dédoublonnage (accents/casse), tri fr. */
export function normalizeSites(raw: unknown): string[] {
  const arr = Array.isArray(raw) ? raw : [];
  const seen = new Map<string, string>();
  for (const x of arr) {
    const s = String(x ?? '').trim();
    if (s && !seen.has(norm(s))) seen.set(norm(s), s);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
}

/**
 * Liste des sites / chantiers proposée **partout** (mission, affectation, véhicule, PEC…).
 * Il n'existe pas de table `sites` : la liste = référentiel éditable `SITES`
 * (Paramètres › Listes Flotte) **∪** sites déjà présents dans les données réelles
 * (site de rattachement des véhicules, affectations, véhicules externes).
 *
 * Retour DG : ces champs doivent être des **listes**, pas de saisie libre
 * (évite « Hassi Messaoud » / « hassi messaoud » / « H.M. »).
 */
export function useSiteNames(): string[] {
  const cfg = useConfig<string[]>('SITES');
  const vehicles = useVehicles();
  const assignments = useVehicleAssignments();
  const externals = useExternalVehicles();

  return useMemo(() => {
    const seen = new Map<string, string>(); // clé normalisée → 1re orthographe rencontrée
    const add = (v: unknown) => {
      const s = typeof v === 'string' ? v.trim() : '';
      if (!s) return;
      const k = norm(s);
      if (!seen.has(k)) seen.set(k, s);
    };
    for (const s of Array.isArray(cfg.data) ? cfg.data : []) add(s);
    for (const v of vehicles.data ?? []) add(v.siteBase);
    for (const a of assignments.data ?? []) add((a as { siteCode?: string | null }).siteCode);
    for (const e of (externals.data ?? []) as Array<{ siteCode?: string | null }>) add(e.siteCode);
    return [...seen.values()].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  }, [cfg.data, vehicles.data, assignments.data, externals.data]);
}

/** Ajoute `current` en tête s'il n'est pas déjà dans la liste (valeur legacy conservée). */
export function withCurrentSite(list: string[], current: unknown): string[] {
  const c = current == null ? '' : String(current).trim();
  return c && !list.some((s) => norm(s) === norm(c)) ? [c, ...list] : list;
}
