import { ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

interface DepRule {
  table: string;
  column: string;
  label: string;
}

/**
 * Registre des dependances entre ressources.
 * Regle DG : un enregistrement ayant des liens ne doit pas etre supprime.
 */
const RULES: Record<string, DepRule[]> = {
  vehicles: [
    { table: 'missions', column: 'vehicleCode', label: 'mission(s)' },
    { table: 'maintenance_orders', column: 'vehicleCode', label: 'ordre(s) de travail' },
    { table: 'fuel_entries', column: 'vehicleCode', label: 'plein(s) carburant' },
    { table: 'engine_fuel_entries', column: 'vehicleCode', label: 'plein(s) engin' },
    { table: 'lease_contracts', column: 'vehicleCode', label: 'contrat(s) de location' },
    { table: 'lease_pointage', column: 'vehicleCode', label: 'pointage(s) location' },
    { table: 'km_readings', column: 'vehicleCode', label: 'releve(s) kilometrique(s)' },
    { table: 'vehicle_assignments', column: 'vehicleCode', label: 'affectation(s)' },
    { table: 'site_pointage', column: 'targetCode', label: 'pointage(s) site' },
    { table: 'fuel_cards', column: 'vehicleCode', label: 'carte(s) carburant' },
    { table: 'fuel_card_movements', column: 'vehicleCode', label: 'mouvement(s) carte' },
    { table: 'commercial_reports', column: 'vehicleCode', label: 'releve(s) commercial' },
    { table: 'incidents', column: 'vehicleCode', label: 'incident(s)' },
  ],
  'fuel-cards': [{ table: 'fuel_card_movements', column: 'cardId', label: 'mouvement(s)' }],
  drivers: [
    { table: 'missions', column: 'driverCode', label: 'mission(s)' },
    { table: 'fuel_entries', column: 'driverCode', label: 'plein(s) carburant' },
    { table: 'vehicles', column: 'driverCode', label: 'vehicule(s) affecte(s)' },
  ],
  suppliers: [
    { table: 'maintenance_orders', column: 'supplierCode', label: 'ordre(s) de travail' },
    { table: 'purchase_orders', column: 'supplierCode', label: 'bon(s) de commande' },
  ],
  'business-units': [{ table: 'missions', column: 'bu', label: 'mission(s)' }],
  'maintenance-orders': [{ table: 'purchase_orders', column: 'otNum', label: 'bon(s) de commande' }],
  'lease-contracts': [{ table: 'lease_pointage', column: 'vehicleCode', label: 'pointage(s)' }],
};

@Injectable()
export class DependencyService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /** Renvoie la liste (formatee) des dependances bloquantes, vide si suppression possible. */
  async check(resource: string, id: string | number): Promise<string[]> {
    const rules = RULES[resource] ?? [];
    const found: string[] = [];
    for (const r of rules) {
      try {
        const rows = await this.ds.query(
          `SELECT COUNT(*)::int AS c FROM "${r.table}" WHERE "${r.column}" = $1`,
          [String(id)],
        );
        const c = rows?.[0]?.c ?? 0;
        if (c > 0) found.push(`${c} ${r.label}`);
      } catch {
        // table pas encore creee (phase en cours) -> on ignore
      }
    }
    return found;
  }

  /** Leve une 409 si des dependances existent. */
  async assertRemovable(resource: string, id: string | number): Promise<void> {
    const deps = await this.check(resource, id);
    if (deps.length) {
      throw new ConflictException(
        `Suppression impossible : cet element est lie a ${deps.join(', ')}. Supprimez ou reaffectez ces elements d'abord.`,
      );
    }
  }
}
