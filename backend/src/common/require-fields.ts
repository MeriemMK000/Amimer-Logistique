import { BadRequestException } from '@nestjs/common';

export interface RequiredField {
  key: string;
  label: string;
  /** la valeur doit être un nombre > 0 */
  positive?: boolean;
  /** au moins un des champs de ce groupe doit être renseigné */
  oneOf?: string[];
}

/**
 * Garde-fou serveur : bloque la création d'un enregistrement incomplet (retour DG —
 * « les choses qu'il ne faut pas passer sans, ex. mission sans véhicule »).
 * Lève un 400 avec la liste des champs manquants.
 */
export function requireFields(data: Record<string, unknown>, fields: RequiredField[]): void {
  const empty = (v: unknown) => v == null || v === '' || (Array.isArray(v) && v.length === 0);
  const missing: string[] = [];

  for (const f of fields) {
    if (f.oneOf) {
      if (f.oneOf.every((k) => empty(data[k]))) missing.push(f.label);
      continue;
    }
    if (empty(data[f.key])) { missing.push(f.label); continue; }
    if (f.positive && !(Number(data[f.key]) > 0)) missing.push(f.label);
  }

  if (missing.length) {
    throw new BadRequestException(
      `Champs obligatoires manquants ou invalides : ${missing.join(', ')}.`,
    );
  }
}
