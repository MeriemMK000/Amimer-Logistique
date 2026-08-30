import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Vehicle } from '../../vehicles/vehicle.entity';

@Entity('erp_imports')
export class ErpImport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  type: string;

  @Column({ nullable: true })
  reference: string;

  @Column({ name: 'vehicle_id', nullable: true })
  vehicleId: string;

  @ManyToOne(() => Vehicle, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle;

  @Column({ name: 'data_json', type: 'jsonb', nullable: true })
  dataJson: Record<string, unknown>;

  @Column({ default: 'PENDING' })
  status: string;

  @Column({ name: 'imported_at', type: 'timestamp', nullable: true })
  importedAt: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
