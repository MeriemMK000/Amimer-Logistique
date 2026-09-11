import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('control_requests')
export class ControlRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  vehicleCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  driverCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  generatedAt: string | null;

  @Column({ type: 'varchar', nullable: true })
  dueDate: string | null;

  @Column({ type: 'varchar', nullable: true })
  reason: string | null;

  @Column({ type: 'double precision', nullable: true })
  weight: number | null;

  @Column({ type: 'varchar', nullable: true })
  status: string | null;

  @Column({ type: 'int', nullable: true })
  km: number | null;

  @Column({ type: 'varchar', nullable: true })
  etat: string | null;

  // Fiche de contrôle par rubrique (retour DG) :
  // [{ key, label, etat: 'bon'|'moyen'|'mauvais', maintenance: bool, comment: string }]
  @Column({ type: 'jsonb', nullable: true })
  categories: any | null;

  // OT curatif créé si un point est jugé mauvais / à signaler en maintenance.
  @Column({ type: 'varchar', nullable: true })
  otNum: string | null;

  @Column({ type: 'double precision', nullable: true })
  score: number | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'varchar', nullable: true })
  photoId: string | null;

  @Column({ type: 'varchar', nullable: true })
  respondedAt: string | null;

  @Column({ type: 'timestamptz', nullable: true, default: () => 'now()' })
  createdAt: Date | null;
}
