import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Modele d'entretien preventif (Partie 3). Ex : a 10 000 km -> vidange + filtres = 15 000 DZD. */
@Entity('maintenance_plans')
export class MaintenancePlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  // type | marque | modele | vehicles
  @Column({ type: 'varchar', default: 'type' })
  targetKind: string;

  @Column({ type: 'varchar', nullable: true })
  targetValue: string | null; // 'LOURD', 'Toyota', 'Hilux 2.4D'...

  @Column({ type: 'jsonb', nullable: true })
  targetVehicles: string[] | null; // si targetKind = 'vehicles'

  // KM | HOURS
  @Column({ type: 'varchar', default: 'KM' })
  trigger: string;

  @Column({ type: 'int' })
  intervalValue: number; // 10000 (km) ou 1000 (h)

  @Column({ type: 'int', nullable: true })
  intervalMonths: number | null; // rappel calendaire optionnel

  @Column({ type: 'jsonb', nullable: true })
  operations: { label: string; coutEstime: number }[] | null;

  @Column({ type: 'int', default: 90 })
  alertThresholdPct: number; // alerte des qu'on atteint X% de l'intervalle

  @Column({ type: 'boolean', default: true })
  active: boolean;
}
