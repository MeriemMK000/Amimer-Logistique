import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('evaluations')
export class Evaluation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  subjectType: string | null;

  @Column({ type: 'varchar', nullable: true })
  subjectCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  date: string | null;

  @Column({ type: 'int', nullable: true })
  score: number | null;

  @Column({ type: 'jsonb', nullable: true })
  criteria: any | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'varchar', nullable: true })
  source: string | null;

  @Column({ type: 'varchar', nullable: true })
  relatedVehicle: string | null;

  @Column({ type: 'varchar', nullable: true })
  relatedDriver: string | null;
}
