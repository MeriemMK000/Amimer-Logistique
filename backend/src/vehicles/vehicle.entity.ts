import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { VehicleType, VehicleStatus, OwnershipType, FuelType } from '../common/enums';

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  code: string;

  @Column({ type: 'enum', enum: VehicleType })
  type: VehicleType;

  @Column()
  brand: string;

  @Column()
  model: string;

  @Column()
  year: number;

  @Column({ nullable: true })
  vin: string;

  @Column({ name: 'plate_number' })
  plateNumber: string;

  @Column({ name: 'ownership_type', type: 'enum', enum: OwnershipType, default: OwnershipType.PROPRE })
  ownershipType: OwnershipType;

  @Column({ name: 'fuel_type', type: 'enum', enum: FuelType, default: FuelType.GASOIL })
  fuelType: FuelType;

  @Column({ type: 'enum', enum: VehicleStatus, default: VehicleStatus.DISPONIBLE })
  status: VehicleStatus;

  @Column({ name: 'fuel_card_number', nullable: true })
  fuelCardNumber: string;

  @Column({ name: 'fuel_budget', type: 'decimal', precision: 12, scale: 2, nullable: true })
  fuelBudget: number;

  @Column({ name: 'constructor_norm_consumption', type: 'decimal', precision: 6, scale: 2, nullable: true })
  constructorNormConsumption: number;

  @Column({ name: 'consumption_correction_factor', type: 'decimal', precision: 4, scale: 2, default: 1.0 })
  consumptionCorrectionFactor: number;

  @Column({ name: 'consumption_margin', type: 'decimal', precision: 4, scale: 2, default: 5.0 })
  consumptionMargin: number;

  @Column({ name: 'current_mileage', type: 'decimal', precision: 12, scale: 2, default: 0 })
  currentMileage: number;

  @Column({ name: 'current_hours', type: 'decimal', precision: 10, scale: 2, default: 0 })
  currentHours: number;

  @Column({ name: 'acquisition_date', type: 'date', nullable: true })
  acquisitionDate: Date;

  @Column({ name: 'decommission_date', type: 'date', nullable: true })
  decommissionDate: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
