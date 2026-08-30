import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { MaintenanceOrder } from './maintenance-order.entity';

@Entity('maintenance_parts')
export class MaintenancePart {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id' })
  orderId: string;

  @ManyToOne(() => MaintenanceOrder, (order) => order.parts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: MaintenanceOrder;

  @Column({ name: 'part_name' })
  partName: string;

  @Column({ name: 'part_number', nullable: true })
  partNumber: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 1 })
  quantity: number;

  @Column({ name: 'unit_cost', type: 'decimal', precision: 12, scale: 2 })
  unitCost: number;

  @Column({ name: 'total_cost', type: 'decimal', precision: 12, scale: 2 })
  totalCost: number;
}
