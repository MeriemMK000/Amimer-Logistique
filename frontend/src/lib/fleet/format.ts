// Helpers de formatage — portage verbatim de v8 (fk, sb).

export const fk = (n: number | string | null | undefined): string =>
  typeof n === 'number' ? n.toLocaleString('fr-FR') : n == null ? '—' : String(n);

/**
 * Formatage de date **français jj/mm/aaaa** (retour DG : partout dans la plateforme).
 * Accepte ISO `AAAA-MM-JJ`, `AAAA-MM`, un `Date`, ou un horodatage. Vide / invalide → `—`.
 * `withTime` ajoute l'heure (jj/mm/aaaa HH:MM) si l'entrée en contient une.
 */
export function fd(input: string | number | Date | null | undefined, opts?: { withTime?: boolean; monthOnly?: boolean }): string {
  if (input == null || input === '') return '—';
  if (typeof input === 'string') {
    const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?(?:[ T](\d{2}):(\d{2}))?/.exec(input.trim());
    if (m) {
      const [, y, mo, d, hh, mm] = m;
      if (opts?.monthOnly || !d) return `${mo}/${y}`;
      const base = `${d}/${mo}/${y}`;
      return opts?.withTime && hh ? `${base} ${hh}:${mm}` : base;
    }
    // jj/mm/aaaa déjà français, ou autre libellé → renvoyé tel quel
    if (/^\d{2}\/\d{2}\/\d{4}/.test(input.trim())) return input.trim();
  }
  const dt = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(dt.getTime())) return String(input);
  const p = (n: number) => String(n).padStart(2, '0');
  const base = `${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${dt.getFullYear()}`;
  return opts?.withTime ? `${base} ${p(dt.getHours())}:${p(dt.getMinutes())}` : base;
}

// v8: const sb=(s)=>{ ...map... } — ici on renvoie [label, classeCouleur]
const STATUS_MAP: Record<string, [string, string]> = {
  DISPONIBLE: ['Disponible', 'bg-g'],
  EN_MISSION: ['En Mission', 'bg-b'],
  EN_MAINTENANCE: ['Maintenance', 'bg-a'],
  EN_PANNE: ['En Panne', 'bg-r'],
  HORS_SERVICE: ['Hors Service', 'bg-r'],
  PLANIFIEE: ['Planifiée', 'bg-t'],
  EN_COURS: ['En Cours', 'bg-b'],
  TERMINEE: ['Terminée', 'bg-g'],
  CLOTUREE: ['Clôturée', 'bg-t'],
  PLANIFIE: ['Planifié', 'bg-t'],
  TERMINE: ['Terminé', 'bg-g'],
  HAUTE: ['Haute', 'bg-r'],
  MOYENNE: ['Moyenne', 'bg-a'],
  CRITIQUE: ['Critique', 'bg-r'],
  BASSE: ['Basse', 'bg-g'],
  EN_REPOS: ['Repos', 'bg-a'],
  VALIDE: ['Valide', 'bg-g'],
  URGENT: ['Urgent', 'bg-a'],
  EXPIRE: ['Expiré', 'bg-r'],
  'N/A': ['N/A', 'bg-t'],
  EN_ATTENTE: ['En attente', 'bg-a'],
  VALIDEE: ['Validée', 'bg-g'],
  TRANSFORMEE: ['Transformée', 'bg-t'],
  REFUSEE: ['Refusée', 'bg-r'],
  LIVREE: ['Livrée', 'bg-g'],
};

export function statusInfo(s: string | null | undefined): { label: string; cls: string } {
  if (!s) return { label: '—', cls: 'bg-b' };
  const [label, cls] = STATUS_MAP[s] ?? [s, 'bg-b'];
  return { label, cls };
}

export const MOIS_NOM = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
