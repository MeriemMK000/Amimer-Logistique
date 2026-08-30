import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ExpenseStatus } from '../../common/enums';
import { Mission } from '../../missions/mission.entity';
import { Driver } from '../../drivers/driver.entity';

@Entity('mission_expenses')
export class MissionExpense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'mission_id' })
  missionId: string;

  @ManyToOne(() => Mission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mission_id' })
  mission: Mission;

  @Column({ name: 'driver_id' })
  driverId: string;

  @ManyToOne(() => Driver, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'driver_id' })
  driver: Driver;

  @Column({ name: 'expense_type' })
  expenseType: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ name: 'calculation_basis', nullable: true })
  calculationBasis: string;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  days: number;

  @Column({ name: 'distance_km', type: 'decimal', precision: 10, scale: 2, nullable: true })
  distanceKm: number;

  @Column({ type: 'enum', enum: ExpenseStatus, default: ExpenseStatus.CALCULE })
  status: ExpenseStatus;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
