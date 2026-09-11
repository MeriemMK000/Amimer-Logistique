import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Piece jointe polymorphe (photos, memos vocaux, cartes grises, justificatifs OT, docs pneus...). */
@Entity('attachments')
export class Attachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  entityType: string; // vehicle | maintenance-order | tire-movement | incident | mission | driver-report | pec

  @Column({ type: 'varchar' })
  entityId: string;

  @Column({ type: 'varchar', default: 'doc' })
  kind: string; // photo | voice | carte_grise | assurance | ot_bc | ot_justif | tire_signed | ...

  @Column({ type: 'varchar' })
  filename: string; // nom d'origine

  @Column({ type: 'varchar' })
  storedName: string; // nom sur disque

  @Column({ type: 'varchar', nullable: true })
  mime: string | null;

  @Column({ type: 'int', nullable: true })
  size: number | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  uploadedAt: Date;
}
