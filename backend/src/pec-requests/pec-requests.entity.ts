import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('pec_requests')
export class PecRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  ref: string | null;

  @Column({ type: 'varchar', nullable: true })
  requesterName: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ type: 'varchar', nullable: true })
  organisation: string | null;

  @Column({ type: 'varchar', nullable: true })
  structure: string | null; // structure / personnel à transporter

  @Column({ type: 'varchar', nullable: true })
  fromLoc: string | null;

  @Column({ type: 'varchar', nullable: true })
  toLoc: string | null;

  @Column({ type: 'varchar', nullable: true })
  dateAller: string | null;

  @Column({ type: 'varchar', nullable: true })
  dateRetour: string | null;

  @Column({ type: 'int', nullable: true })
  pax: number | null;

  @Column({ type: 'varchar', nullable: true })
  source: string | null; // public | amimer_energie

  @Column({ type: 'varchar', nullable: true })
  status: string | null; // nouvelle | validee | refusee | en_mission

  @Column({ type: 'boolean', nullable: true })
  fraisApplicable: boolean | null;

  @Column({ type: 'double precision', nullable: true })
  distanceKm: number | null;

  @Column({ type: 'varchar', nullable: true })
  workLocation: string | null;

  @Column({ type: 'varchar', nullable: true })
  missionRef: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'timestamptz', nullable: true, default: () => 'now()' })
  createdAt: Date | null;
}
