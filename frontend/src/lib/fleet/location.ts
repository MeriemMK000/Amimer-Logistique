import type { LeaseContract, LeasePointage } from '../types';

/** Prix d'immobilisation d'un contrat (défaut : ~50 % du prix quotidien). */
export function immoPrice(ct: LeaseContract | null | undefined): number {
  if (!ct) return 0;
  return ct.immobilizationPrice ?? Math.round((ct.dailyPrice ?? 0) * 0.5);
}

/** Coût d'un jour de pointage location : immobilisé → prix immo, sinon prix/jour × fraction. */
export function leaseDayCost(p: LeasePointage, ct: LeaseContract | null | undefined): number {
  if (!ct) return 0;
  if (p.immobilized) return immoPrice(ct);
  return (p.fraction ?? (p.present ? 1 : 0)) * (ct.dailyPrice ?? 0);
}

/** Agrégat d'un véhicule sur un mois (YYYY-MM) : coût, jours pointés, jours d'immobilisation. */
export function leaseMonthAgg(
  vh: string, yearMonth: string, pointage: LeasePointage[], contracts: LeaseContract[],
): { cost: number; days: number; immoDays: number } {
  const ct = getContractForMonth(vh, yearMonth, contracts);
  let cost = 0, days = 0, immoDays = 0;
  for (const p of pointage) {
    if (p.vehicleCode !== vh || !p.date?.startsWith(yearMonth)) continue;
    if (p.immobilized) { cost += immoPrice(ct); immoDays += 1; }
    else { const fr = p.fraction ?? (p.present ? 1 : 0); cost += fr * (ct?.dailyPrice ?? 0); days += fr; }
  }
  return { cost, days, immoDays };
}

export function getActiveContract(vh: string, contracts: LeaseContract[], dateStr?: string): LeaseContract | null {
  const d = dateStr || new Date().toISOString().slice(0, 10);
  return contracts
    .filter((c) => c.vehicleCode === vh && c.startDate <= d && c.endDate >= d)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0] ?? null;
}

export function getContractForMonth(vh: string, yearMonth: string, contracts: LeaseContract[]): LeaseContract | null {
  const [y, m] = yearMonth.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const ms = `${yearMonth}-01`;
  const me = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;
  return contracts
    .filter((c) => c.vehicleCode === vh && c.startDate <= me && c.endDate >= ms)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0] ?? null;
}

export function last6Months(): { value: string; label: string }[] {
  const names = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const today = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    return { value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: `${names[d.getMonth()]} ${d.getFullYear()}` };
  });
}
