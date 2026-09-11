// Référentiel marques / modèles de véhicules.
//
// Source des données : `@meterapp/vehicle-db` (base NHTSA vPIC, voitures particulières
// + MPV) filtrée pour retirer le bruit d'immatriculation, complétée d'un supplément curé
// pour les marques Europe / Chine / utilitaires courantes sur le parc algérien
// (Peugeot, Renault, Citroën, Dacia, Škoda, Chery, JAC, Iveco, MAN, Sinotruk, SNVI…).
//
// Régénération : voir le script one-shot dans le scratchpad de dev (npm pack
// @meterapp/vehicle-db). Le fichier `car-catalog.json` est la donnée finale, éditable
// à la main pour ajouter une marque / un modèle manquant.
//
// Retour DG : « pour la marque, une liste de toutes les marques du monde, puis le modèle
// correspondant, et comme les listes sont longues on doit pouvoir rechercher dedans. »

import raw from './car-catalog.json';

export type CarCatalog = Record<string, string[]>;

export const CAR_CATALOG: CarCatalog = raw as CarCatalog;

/** Toutes les marques, triées (ordre du fichier, déjà alphabétique fr). */
export const CAR_MAKES: string[] = Object.keys(CAR_CATALOG);

const COMBINING = /[̀-ͯ]/g;
const norm = (s: unknown) =>
  String(s ?? '').normalize('NFD').replace(COMBINING, '').toLowerCase().trim();

/**
 * Filtre une liste sur la saisie : préfixes d'abord, puis sous-chaînes.
 * `limit` borne le nombre de suggestions (listes très longues).
 */
export function filterList(list: string[], query: string, limit = 50): string[] {
  const q = norm(query);
  if (!q) return list.slice(0, limit);
  const parts = q.split(/\s+/);
  const starts: string[] = [];
  const contains: string[] = [];
  for (const item of list) {
    const n = norm(item);
    if (!parts.every((p) => n.includes(p))) continue;
    (n.startsWith(parts[0]) ? starts : contains).push(item);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}

/** Modèles connus d'une marque (vide si marque libre / inconnue). */
export function modelsFor(make: string | null | undefined): string[] {
  if (!make) return [];
  const exact = CAR_CATALOG[make];
  if (exact) return exact;
  const key = CAR_MAKES.find((m) => norm(m) === norm(make));
  return key ? CAR_CATALOG[key] : [];
}
