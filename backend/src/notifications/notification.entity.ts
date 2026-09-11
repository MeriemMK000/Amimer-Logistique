import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Notification métier (retour DG) : informer les acteurs d'un événement — surtout
 * le demandeur d'une mission quand elle est validée (chauffeur + itinéraire confirmés).
 * Toujours enregistrée en base (visible dans l'app même sans relais SMTP) ; l'email
 * part en plus si un SMTP est configuré.
 */
@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // À qui : 'requester' (demandeur PEC) | 'driver' (chauffeur) | 'office' (logistique).
  @Column({ type: 'varchar', nullable: true })
  audience: string | null;

  @Column({ type: 'varchar', nullable: true })
  recipientName: string | null;

  @Column({ type: 'varchar', nullable: true })
  recipientEmail: string | null;

  @Column({ type: 'varchar', nullable: true })
  recipientPhone: string | null;

  // Type d'événement : 'mission_validee' | 'mission_modifiee' | 'ordre_emis' | ...
  @Column({ type: 'varchar', nullable: true })
  kind: string | null;

  @Column({ type: 'varchar', nullable: true })
  subject: string | null;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ type: 'varchar', nullable: true })
  missionRef: string | null;

  // Lien de suivi public éventuel.
  @Column({ type: 'varchar', nullable: true })
  link: string | null;

  @Column({ type: 'boolean', nullable: true, default: false })
  read: boolean | null;

  // 'pending' | 'sent' | 'skipped' (pas d'email / pas de SMTP) | 'failed'
  @Column({ type: 'varchar', nullable: true, default: 'pending' })
  emailStatus: string | null;

  @Column({ type: 'timestamptz', nullable: true, default: () => 'now()' })
  createdAt: Date | null;
}
