import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { MaintenanceType } from '../../common/enums';
import { Vehicle } from '../../vehicles/vehicle.entity';

@Entity('maintenance_plans')
export class MaintenancePlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'vehicle_id' })
  vehicleId: string;

  @ManyToOne(() => Vehicle, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle;

  @Column({ type: 'enum', enum: MaintenanceType })
  type: MaintenanceType;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'interval_km', nullable: true })
  intervalKm: number;

  @Column({ name: 'interval_days', nullable: true })
  intervalDays: number;

  @Column({ name: 'last_performed_date', type: 'date', nullable: true })
  lastPerformedDate: Date;

  @Column({ name: 'last_performed_km', type: 'decimal', precision: 12, scale: 2, nullable: true })
  lastPerformedKm: number;

  @Column({ name: 'next_due_date', type: 'date', nullable: true })
  nextDueDate: Date;

  @Column({ name: 'next_due_km', type: 'decimal', precision: 12, scale: 2, nullable: true })
  nextDueKm: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
