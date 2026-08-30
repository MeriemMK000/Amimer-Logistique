import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { MaintenanceType, MaintenanceStatus } from '../../common/enums';
import { Vehicle } from '../../vehicles/vehicle.entity';
import { MaintenancePlan } from './maintenance-plan.entity';
import { MaintenancePart } from './maintenance-part.entity';

@Entity('maintenance_orders')
export class MaintenanceOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'vehicle_id' })
  vehicleId: string;

  @ManyToOne(() => Vehicle, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle;

  @Column({ name: 'plan_id', nullable: true })
  planId: string;

  @ManyToOne(() => MaintenancePlan, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'plan_id' })
  plan: MaintenancePlan;

  @Column({ type: 'enum', enum: MaintenanceType })
  type: MaintenanceType;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: MaintenanceStatus, default: MaintenanceStatus.PLANIFIE })
  status: MaintenanceStatus;

  @Column({ default: 'NORMALE' })
  priority: string;

  @Column({ name: 'reported_date', type: 'date', nullable: true })
  reportedDate: Date;

  @Column({ name: 'scheduled_date', type: 'date', nullable: true })
  scheduledDate: Date;

  @Column({ name: 'started_date', type: 'date', nullable: true })
  startedDate: Date;

  @Column({ name: 'completed_date', type: 'date', nullable: true })
  completedDate: Date;

  @Column({ name: 'estimated_cost', type: 'decimal', precision: 12, scale: 2, nullable: true })
  estimatedCost: number;

  @Column({ name: 'actual_cost', type: 'decimal', precision: 12, scale: 2, nullable: true })
  actualCost: number;

  @Column({ nullable: true })
  vendor: string;

  @OneToMany(() => MaintenancePart, (part) => part.order, { cascade: true })
  parts: MaintenancePart[];

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
