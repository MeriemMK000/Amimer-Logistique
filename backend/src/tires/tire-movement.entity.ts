import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Mouvement de pneumatique : achat / montage / depose / transfert / rebut. Historise. */
@Entity('tire_movements')
export class TireMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  tireId: string;

  // achat | montage | depose | transfert | rebut
  @Column({ type: 'varchar' })
  type: string;

  @Column({ type: 'varchar', nullable: true })
  fromVehicle: string | null;

  @Column({ type: 'varchar', nullable: true })
  toVehicle: string | null;

  @Column({ type: 'varchar', nullable: true })
  position: string | null;

  @Column({ type: 'int', nullable: true })
  km: number | null;

  @Column({ type: 'varchar' })
  date: string;

  @Column({ type: 'varchar', nullable: true })
  signedBy: string | null; // beneficiaire ayant signe le document

  @Column({ type: 'varchar', nullable: true })
  attachmentId: string | null; // document signe (attachments)

  @Column({ type: 'text', nullable: true })
  note: string | null;

  // Pneu remplacé lors d'un montage (déposé en même temps) — retour DG.
  @Column({ type: 'varchar', nullable: true })
  replacedTireId: string | null;

  // Validation du detenteur du vehicule concerne par le montage / transfert.
  @Column({ type: 'boolean', nullable: true })
  holderValidated: boolean | null;

  @Column({ type: 'varchar', nullable: true })
  holderValidatedAt: string | null;

  @Column({ type: 'varchar', nullable: true })
  holderValidatedBy: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
