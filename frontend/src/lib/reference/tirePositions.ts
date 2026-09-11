/**
 * Positions des pneumatiques par type de véhicule.
 *  - Léger  : 4 roues + secours = 5
 *  - Lourd  : essieu avant + essieu arrière jumelé + secours = 7 (dépend du type)
 *  - Engin  : 4 (variable selon l'engin)
 *  - Remorque : essieu(x) jumelés + secours
 */
export const TIRE_POSITIONS: Record<string, string[]> = {
  LEGER: ['AVG', 'AVD', 'ARG', 'ARD', 'Secours'],
  LOURD: ['AVG', 'AVD', 'ARG ext.', 'ARG int.', 'ARD ext.', 'ARD int.', 'Secours'],
  ENGIN: ['AVG', 'AVD', 'ARG', 'ARD'],
  REMORQUE: ['ARG ext.', 'ARG int.', 'ARD ext.', 'ARD int.', 'Secours'],
};

export function positionsFor(type: string | null | undefined): string[] {
  return TIRE_POSITIONS[(type ?? '').toUpperCase()] ?? TIRE_POSITIONS.LEGER;
}

/** Nombre de pneus « en service » attendus (hors secours). */
export function expectedTireCount(type: string | null | undefined): number {
  const list = positionsFor(type);
  return list.filter((p) => !/secours/i.test(p)).length;
}
