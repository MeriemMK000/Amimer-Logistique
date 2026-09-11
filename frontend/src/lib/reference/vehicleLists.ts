// Retour DG : « Flotte — mettez en zone de liste modifiable, on peut ajouter d'autres
// enregistrements. Ça évite l'erreur de saisie. Type / Genre carburant / Propriété. »
// Listes de référence éditables dans Paramètres › Listes Flotte (clé AppConfig VEHICLE_LISTS).
export interface VehicleLists {
  type: string[];
  genre: string[];
  fuel: string[];
  ownership: string[];
}

// Valeurs canoniques : toujours présentes (le moteur métier s'appuie dessus), l'utilisateur
// peut en ajouter d'autres.
export const VEHICLE_LIST_DEFAULTS: VehicleLists = {
  type: ['LEGER', 'LOURD', 'ENGIN', 'REMORQUE'],
  genre: ['VIP', 'CTTE', 'CAM', 'TR', 'ENGIN', 'REMORQUE'],
  fuel: ['GASOIL', 'ESSENCE', 'GPL'],
  ownership: ['PROPRE', 'LEASING', 'LOCATION'],
};

export const VEHICLE_LIST_LABELS: Record<keyof VehicleLists, string> = {
  type: 'Type',
  genre: 'Genre',
  fuel: 'Carburant',
  ownership: 'Propriété',
};

/** Fusionne la config avec les valeurs canoniques (dédupliquées, canoniques en tête). */
export function normalizeVehicleLists(raw: Partial<VehicleLists> | null | undefined): VehicleLists {
  const merge = (k: keyof VehicleLists): string[] => {
    const extra = (raw?.[k] ?? [])
      .map((x) => String(x).trim())
      .filter(Boolean);
    return Array.from(new Set([...VEHICLE_LIST_DEFAULTS[k], ...extra]));
  };
  return { type: merge('type'), genre: merge('genre'), fuel: merge('fuel'), ownership: merge('ownership') };
}
