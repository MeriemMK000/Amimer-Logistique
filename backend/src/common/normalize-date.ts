/**
 * Normalise une date saisie vers le format ISO `YYYY-MM-DD`, pour que tous les
 * filtres « mois » du système la reconnaissent (contrôle carburant, registres, rapports).
 * Accepte : YYYY-MM-DD · YYYY/MM/DD · DD/MM/YYYY · DD-MM-YYYY · DD/MM · DD-MM
 * (DD/MM sans année → année courante). Valeur non reconnue → renvoyée telle quelle.
 */
export function normalizeDate(input: unknown): string | null {
  if (input == null || input === '') return (input as null) ?? null;
  const s = String(input).trim();

  // déjà ISO (jour optionnel)
  let m = s.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${(m[3] ?? '1').padStart(2, '0')}`;

  // YYYY/MM/DD
  m = s.match(/^(\d{4})\/(\d{1,2})(?:\/(\d{1,2}))?$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${(m[3] ?? '1').padStart(2, '0')}`;

  // DD/MM/YYYY · DD-MM-YYYY · DD/MM · DD-MM
  m = s.match(/^(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?$/);
  if (m) {
    const day = m[1].padStart(2, '0');
    const mon = m[2].padStart(2, '0');
    const yr = m[3]
      ? (m[3].length === 2 ? `20${m[3]}` : m[3])
      : String(new Date().getFullYear());
    return `${yr}-${mon}-${day}`;
  }

  return s;
}
