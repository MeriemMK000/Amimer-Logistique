import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { MissionZone } from '../../mission-zones/mission-zone.entity';

@Entity('expense_scales')
export class ExpenseScale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ name: 'zone_id', nullable: true })
  zoneId: string;

  @ManyToOne(() => MissionZone, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'zone_id' })
  zone: MissionZone;

  @Column({ name: 'per_diem_rate', type: 'decimal', precision: 12, scale: 2, default: 0 })
  perDiemRate: number;

  @Column({ name: 'meal_rate', type: 'decimal', precision: 12, scale: 2, default: 0 })
  mealRate: number;

  @Column({ name: 'accommodation_rate', type: 'decimal', precision: 12, scale: 2, default: 0 })
  accommodationRate: number;

  @Column({ name: 'km_rate', type: 'decimal', precision: 8, scale: 4, default: 0 })
  kmRate: number;

  @Column({ name: 'effective_date', type: 'date' })
  effectiveDate: Date;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
