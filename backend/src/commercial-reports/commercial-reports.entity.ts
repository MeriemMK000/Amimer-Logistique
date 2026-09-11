import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('commercial_reports')
export class CommercialReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  vehicleCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  month: string | null;

  @Column({ type: 'int', nullable: true })
  kmStart: number | null;

  @Column({ type: 'int', nullable: true })
  kmEnd: number | null;

  @Column({ type: 'double precision', nullable: true })
  fuelLiters: number | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'varchar', nullable: true })
  source: string | null;

  @Column({ type: 'timestamptz', nullable: true, default: () => 'now()' })
  createdAt: Date | null;
}
