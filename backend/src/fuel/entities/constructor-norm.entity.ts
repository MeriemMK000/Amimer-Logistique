import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { VehicleType, FuelType } from '../../common/enums';

@Entity('constructor_norms')
export class ConstructorNorm {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  brand: string;

  @Column()
  model: string;

  @Column({ nullable: true })
  year: number;

  @Column({ name: 'vehicle_type', type: 'enum', enum: VehicleType, nullable: true })
  vehicleType: VehicleType;

  @Column({ name: 'fuel_type', type: 'enum', enum: FuelType, nullable: true })
  fuelType: FuelType;

  @Column({ name: 'norm_consumption', type: 'decimal', precision: 6, scale: 2 })
  normConsumption: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
