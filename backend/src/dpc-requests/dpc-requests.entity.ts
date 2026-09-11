import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('dpc_requests')
export class DpcRequest {
  @PrimaryColumn({ type: 'varchar' })
  code: string;

  @Column({ type: 'varchar', nullable: true })
  dateSaisie: string | null;

  @Column({ type: 'varchar', nullable: true })
  dateAller: string | null;

  @Column({ type: 'varchar', nullable: true })
  dateRetour: string | null;

  @Column({ type: 'varchar', nullable: true })
  depAller: string | null;

  @Column({ type: 'varchar', nullable: true })
  destAller: string | null;

  @Column({ type: 'varchar', nullable: true })
  depRetour: string | null;

  @Column({ type: 'varchar', nullable: true })
  destRetour: string | null;

  @Column({ type: 'varchar', nullable: true })
  bu: string | null;

  @Column({ type: 'varchar', nullable: true })
  structure: string | null;

  @Column({ type: 'varchar', nullable: true })
  priorite: string | null;

  @Column({ type: 'varchar', nullable: true })
  urgence: string | null;

  @Column({ type: 'varchar', nullable: true })
  statut: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', nullable: true })
  demandeur: string | null;

  @Column({ type: 'varchar', nullable: true })
  missionRef: string | null;

  // Canal d'entrée : saisie interne · formulaire public · plateforme Amimer Énergie.
  @Column({ type: 'varchar', nullable: true, default: 'interne' })
  source: string | null; // 'interne' | 'formulaire' | 'amimer_energie'

  // Coordonnées du demandeur (formulaire public).
  @Column({ type: 'varchar', nullable: true })
  demandeurTel: string | null;

  @Column({ type: 'varchar', nullable: true })
  demandeurEmail: string | null;

  @Column({ type: 'varchar', nullable: true })
  organisation: string | null;

  @Column({ type: 'int', nullable: true })
  pax: number | null;

  // Tonnage de fret nécessaire (transport lourd) — contrôle « tonnage requis » de la mission.
  @Column({ type: 'double precision', nullable: true })
  tonnage: number | null;

  // Référence externe (n° de demande sur la plateforme Amimer Énergie).
  @Column({ type: 'varchar', nullable: true })
  refExterne: string | null;

  @Column({ type: 'double precision', nullable: true })
  distanceKm: number | null;
}
