import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { DriverStatus } from '../common/enums';
import { User } from '../users/user.entity';

@Entity('drivers')
export class Driver {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'employee_number', unique: true })
  employeeNumber: string;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth: Date;

  @Column({ name: 'license_number' })
  licenseNumber: string;

  @Column({ name: 'license_type' })
  licenseType: string;

  @Column({ name: 'license_expiry', type: 'date' })
  licenseExpiry: Date;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  qualification: string;

  @Column({ type: 'enum', enum: DriverStatus, default: DriverStatus.DISPONIBLE })
  status: DriverStatus;

  @Column({ name: 'max_daily_hours', type: 'decimal', precision: 4, scale: 1, default: 10 })
  maxDailyHours: number;

  @Column({ name: 'max_weekly_hours', type: 'decimal', precision: 5, scale: 1, default: 48 })
  maxWeeklyHours: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
