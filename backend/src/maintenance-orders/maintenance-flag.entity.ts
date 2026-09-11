import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Alerte anti-fraude / anti-redondance maintenance (Partie 3), historisee. */
@Entity('maintenance_flags')
export class MaintenanceFlag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  vehicleCode: string;

  @Column({ type: 'varchar', nullable: true })
  otNum: string | null;

  @Column({ type: 'varchar' })
  kind: string; // repeated_operation | recent_same_anomaly | high_consumption

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'boolean', default: false })
  acknowledged: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
