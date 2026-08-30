import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { IncidentType, IncidentSeverity, IncidentStatus } from '../common/enums';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Driver } from '../drivers/driver.entity';

@Entity('incidents')
export class Incident {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'vehicle_id' })
  vehicleId: string;

  @ManyToOne(() => Vehicle, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle;

  @Column({ name: 'driver_id', nullable: true })
  driverId: string;

  @ManyToOne(() => Driver, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'driver_id' })
  driver: Driver;

  @Column({ type: 'enum', enum: IncidentType })
  type: IncidentType;

  @Column({ type: 'date' })
  date: Date;

  @Column({ nullable: true })
  location: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'enum', enum: IncidentSeverity })
  severity: IncidentSeverity;

  @Column({ type: 'enum', enum: IncidentStatus, default: IncidentStatus.OUVERT })
  status: IncidentStatus;

  @Column({ name: 'estimated_cost', type: 'decimal', precision: 12, scale: 2, nullable: true })
  estimatedCost: number;

  @Column({ name: 'actual_cost', type: 'decimal', precision: 12, scale: 2, nullable: true })
  actualCost: number;

  @Column({ name: 'insurance_claim_number', nullable: true })
  insuranceClaimNumber: string;

  @Column({ name: 'insurance_status', nullable: true })
  insuranceStatus: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
