import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('incidents')
export class Incident {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  vehicleCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  driverCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  date: string | null;

  @Column({ type: 'varchar', nullable: true })
  type: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'jsonb', nullable: true })
  photos: any | null;

  @Column({ type: 'varchar', nullable: true })
  status: string | null;

  @Column({ type: 'jsonb', nullable: true })
  statusHistory: any | null;

  @Column({ type: 'varchar', nullable: true })
  insurerSentAt: string | null;

  @Column({ type: 'varchar', nullable: true })
  priseEnChargeAt: string | null;

  @Column({ type: 'varchar', nullable: true })
  priseEnChargeRef: string | null;

  @Column({ type: 'varchar', nullable: true })
  reimbursementExpectedAt: string | null;

  @Column({ type: 'varchar', nullable: true })
  reimbursementReceivedAt: string | null;

  @Column({ type: 'double precision', nullable: true })
  reimbursementAmount: number | null;

  @Column({ type: 'double precision', nullable: true })
  estimatedCost: number | null;

  @Column({ type: 'varchar', nullable: true })
  closedAt: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'timestamptz', nullable: true, default: () => 'now()' })
  createdAt: Date | null;
}
