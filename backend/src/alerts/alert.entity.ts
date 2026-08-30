import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { AlertType, AlertPriority } from '../common/enums';

@Entity('alerts')
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: AlertType })
  type: AlertType;

  @Column({ type: 'enum', enum: AlertPriority, default: AlertPriority.MOYENNE })
  priority: AlertPriority;

  @Column()
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ name: 'related_entity_type', nullable: true })
  relatedEntityType: string;

  @Column({ name: 'related_entity_id', nullable: true })
  relatedEntityId: string;

  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @Column({ name: 'is_dismissed', default: false })
  isDismissed: boolean;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
