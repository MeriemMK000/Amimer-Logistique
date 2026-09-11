import { fd } from '@/lib/fleet/format';

/** Statut d'expiration d'une date d'échéance : none (pas de date), ok, soon (< 60 j), expired. */
export function expiryStatus(expiry?: string | null): { kind: 'none' | 'ok' | 'soon' | 'expired'; days: number | null } {
  if (!expiry) return { kind: 'none', days: null };
  const days = Math.round((new Date(expiry).getTime() - Date.now()) / 86_400_000);
  if (Number.isNaN(days)) return { kind: 'none', days: null };
  return { kind: days < 0 ? 'expired' : days <= 60 ? 'soon' : 'ok', days };
}

/** Pastille d'échéance : rouge = expiré, ambre = < 60 j, verte = à jour (montre la date). */
export default function ExpiryBadge({ expiry, showDate = true }: { expiry?: string | null; showDate?: boolean }) {
  const s = expiryStatus(expiry);
  if (s.kind === 'none') return <span style={{ color: 'var(--tm)' }}>—</span>;
  const cls = s.kind === 'expired' ? 'bg-r' : s.kind === 'soon' ? 'bg-a' : 'bg-g';
  const txt = s.kind === 'expired'
    ? `expiré (${-s.days!} j)`
    : s.kind === 'soon'
      ? `${s.days} j`
      : showDate ? fd(expiry) : 'à jour';
  return <span className={`bg ${cls}`} title={fd(expiry)}>{txt}</span>;
}
