// Portage verbatim de v8 runDataConsistencyCheck.
import type { FuelEntry, MaintenanceOrder, Mission, Vehicle, Driver } from '../types';
import { vhMissionKm } from './consumption';

export function runDataConsistencyCheck(
  V: Vehicle[], D: Driver[], MI: Mission[], FU: FuelEntry[], MT: MaintenanceOrder[],
): { issues: string[]; warnings: string[] } {
  const issues: string[] = [];
  const warnings: string[] = [];
  MI.forEach((m) => { if (!V.find((v) => v.code === m.vehicleCode)) issues.push(`Mission ${m.num} : véhicule ${m.vehicleCode} inexistant`); });
  MI.forEach((m) => { if (!D.find((d) => d.code === m.driverCode)) issues.push(`Mission ${m.num} : chauffeur ${m.driverCode} inexistant`); });
  FU.forEach((f) => { if (!V.find((v) => v.code === f.vehicleCode)) issues.push(`Plein ${f.date} : véhicule ${f.vehicleCode} inexistant`); });
  FU.forEach((f) => { if (!D.find((d) => d.code === f.driverCode)) warnings.push(`Plein ${f.date}/${f.vehicleCode} : chauffeur ${f.driverCode} non trouvé`); });
  MT.forEach((m) => { if (!V.find((v) => v.code === m.vehicleCode)) issues.push(`OT ${m.num} : véhicule ${m.vehicleCode} inexistant`); });
  V.forEach((v) => {
    if (v.status === 'DISPONIBLE' && v.ctStatus === 'EXPIRE') warnings.push(`${v.code} : CT expiré mais statut DISPONIBLE`);
    if (v.status === 'DISPONIBLE' && v.insStatus === 'EXPIRE') warnings.push(`${v.code} : Assurance expirée mais statut DISPONIBLE`);
  });
  D.forEach((d) => { if (d.permanent && d.vehicleCode && !V.find((v) => v.code === d.vehicleCode)) issues.push(`Chauffeur ${d.name} : véhicule permanent ${d.vehicleCode} inexistant`); });
  V.filter((v) => v.ownership === 'LOCATION').forEach((v) => { if (!v.leaseCost || v.leaseCost <= 0) warnings.push(`${v.code} : véhicule en location sans coût mensuel défini`); });
  // Retour DG : le coût du véhicule propre doit être défini pour la refacturation.
  {
    const usedProps = new Set([
      ...MI.filter((m) => m.status !== 'ANNULEE').map((m) => m.vehicleCode),
    ].filter(Boolean) as string[]);
    V.filter((v) => (v.ownership ?? '').toUpperCase() !== 'LOCATION' && usedProps.has(v.code))
      .forEach((v) => {
        if (!v.ownedDailyCost && !v.ownedMonthlyCost && !v.hourlyCost) warnings.push(`${v.code} : véhicule propre utilisé sans coût défini (refacturation impossible)`);
      });
  }
  // Retour DG : le coût du chauffeur doit être défini pour facturer ses heures.
  {
    const usedDrivers = new Set(MI.filter((m) => m.status !== 'ANNULEE').map((m) => m.driverCode).filter(Boolean) as string[]);
    D.filter((d) => d.personType !== 'utilisateur' && usedDrivers.has(d.code))
      .forEach((d) => {
        if (!d.dailyCost && !d.hourlyCost) warnings.push(`${d.name || d.code} : chauffeur utilisé en mission sans coût défini (heures non facturées)`);
      });
  }
  MI.filter((m) => m.status === 'TERMINEE' || m.status === 'CLOTUREE').forEach((m) => { if (!m.distance || m.distance <= 0) warnings.push(`Mission ${m.num} terminée avec 0 km`); });
  FU.forEach((f) => {
    const km = vhMissionKm(f.vehicleCode, MI) + (f.kmCorr ?? 0);
    if (km > 0) { const conso = (f.qty / km) * 100; if (conso > 30) warnings.push(`Plein ${f.date}/${f.vehicleCode} : consommation très élevée (${conso.toFixed(1)} L/100km)`); }
  });
  const mnums: Record<string, number> = {};
  MI.forEach((m) => { mnums[m.num] = (mnums[m.num] || 0) + 1; });
  Object.entries(mnums).forEach(([num, c]) => { if (c > 1) issues.push(`Mission ${num} : numéro en double (${c} occurrences)`); });
  const active = MI.filter((m) => m.status !== 'CLOTUREE' && m.status !== 'ANNULEE');
  active.forEach((m, i) => active.slice(i + 1).forEach((m2) => {
    if (m.vehicleCode === m2.vehicleCode && (m.dateStart ?? '') <= (m2.dateEnd ?? '') && (m.dateEnd ?? '') >= (m2.dateStart ?? ''))
      warnings.push(`Chevauchement véhicule ${m.vehicleCode} : ${m.num} et ${m2.num}`);
  }));
  return { issues, warnings };
}
