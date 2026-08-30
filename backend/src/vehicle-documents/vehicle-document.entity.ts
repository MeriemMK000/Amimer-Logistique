import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { DocumentType } from '../common/enums';
import { Vehicle } from '../vehicles/vehicle.entity';

@Entity('vehicle_documents')
export class VehicleDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'vehicle_id' })
  vehicleId: string;

  @ManyToOne(() => Vehicle, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle;

  @Column({ type: 'enum', enum: DocumentType })
  type: DocumentType;

  @Column({ name: 'document_number', nullable: true })
  documentNumber: string;

  @Column({ name: 'issued_date', type: 'date' })
  issuedDate: Date;

  @Column({ name: 'expiry_date', type: 'date' })
  expiryDate: Date;

  @Column({ name: 'alert_days_before', default: 30 })
  alertDaysBefore: number;

  @Column({ name: 'file_url', nullable: true })
  fileUrl: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
