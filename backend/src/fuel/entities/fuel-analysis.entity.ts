import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Vehicle } from '../../vehicles/vehicle.entity';

@Entity('fuel_analyses')
export class FuelAnalysis {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'vehicle_id' })
  vehicleId: string;

  @ManyToOne(() => Vehicle, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle;

  @Column({ name: 'period_start', type: 'date' })
  periodStart: Date;

  @Column({ name: 'period_end', type: 'date' })
  periodEnd: Date;

  @Column({ name: 'total_km', type: 'decimal', precision: 12, scale: 2 })
  totalKm: number;

  @Column({ name: 'total_fuel', type: 'decimal', precision: 12, scale: 2 })
  totalFuel: number;

  @Column({ name: 'avg_consumption', type: 'decimal', precision: 6, scale: 2 })
  avgConsumption: number;

  @Column({ name: 'norm_consumption', type: 'decimal', precision: 6, scale: 2 })
  normConsumption: number;

  @Column({ name: 'deviation_percent', type: 'decimal', precision: 6, scale: 2 })
  deviationPercent: number;

  @Column({ default: 'NORMAL' })
  status: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
