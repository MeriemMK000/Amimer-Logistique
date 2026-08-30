import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { FuelType } from '../../common/enums';
import { Vehicle } from '../../vehicles/vehicle.entity';
import { Driver } from '../../drivers/driver.entity';
import { Mission } from '../../missions/mission.entity';

@Entity('fuel_entries')
export class FuelEntry {
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

  @Column({ name: 'mission_id', nullable: true })
  missionId: string;

  @ManyToOne(() => Mission, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'mission_id' })
  mission: Mission;

  @Column({ type: 'date' })
  date: Date;

  @Column({ name: 'fuel_type', type: 'enum', enum: FuelType })
  fuelType: FuelType;

  @Column({ name: 'quantity_liters', type: 'decimal', precision: 10, scale: 2 })
  quantityLiters: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 8, scale: 4 })
  unitPrice: number;

  @Column({ name: 'total_cost', type: 'decimal', precision: 12, scale: 2 })
  totalCost: number;

  @Column({ name: 'odometer_reading', type: 'decimal', precision: 12, scale: 2, nullable: true })
  odometerReading: number;

  @Column({ name: 'station_name', nullable: true })
  stationName: string;

  @Column({ name: 'card_number', nullable: true })
  cardNumber: string;

  @Column({ name: 'is_imported', default: false })
  isImported: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
