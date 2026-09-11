import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Rattachement d'un modele d'entretien a un vehicule + suivi de la derniere realisation. */
@Entity('vehicle_maintenance_plans')
export class VehicleMaintenancePlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  planId: string;

  @Column({ type: 'varchar' })
  vehicleCode: string;

  @Column({ type: 'int', nullable: true })
  lastDoneValue: number | null; // km / heures au moment de la derniere realisation

  @Column({ type: 'varchar', nullable: true })
  lastDoneDate: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;
}
