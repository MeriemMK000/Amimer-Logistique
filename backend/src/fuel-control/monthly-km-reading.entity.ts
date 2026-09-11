import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Relevé km (ou heures) début / fin de mois par véhicule — retour DG :
 * « il est important de demander km début / km fin chaque mois » pour contrôler la conso.
 * Unique par (vehicleCode, month).
 */
@Entity('monthly_km_readings')
export class MonthlyKmReading {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  vehicleCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  month: string | null; // YYYY-MM

  @Column({ type: 'int', nullable: true })
  kmStart: number | null;

  @Column({ type: 'int', nullable: true })
  kmEnd: number | null;

  @Column({ type: 'double precision', nullable: true })
  hoursStart: number | null;

  @Column({ type: 'double precision', nullable: true })
  hoursEnd: number | null;

  // Niveau du RÉSERVOIR en litres, début / fin de mois (retour DG) : la vraie conso =
  // Σ pleins de la période − (réservoir fin − réservoir début). Sans ça, 50 L non
  // déclarés dans un réservoir = gros montant caché sur une flotte.
  // Le réservoir début du mois N est reporté automatiquement du réservoir fin du mois N−1.
  @Column({ type: 'double precision', nullable: true })
  tankStart: number | null;

  @Column({ type: 'double precision', nullable: true })
  tankEnd: number | null;

  // Demande de déclaration km au chauffeur (retour DG) : 'pending' | 'done'.
  // Générée automatiquement en fin de mois pour tout véhicule avec activité carburant.
  @Column({ type: 'varchar', nullable: true, default: 'done' })
  status: string | null;

  // Retour DG : deux DEMANDES distinctes par mois et par véhicule, émises TOUTES LES DEUX
  // le 1er du mois (on n'attend pas la fin du mois) —
  //   DÉBUT (ouverture) : km/heures + réservoir de départ  → dû dès le 1er
  //   FIN  (clôture)     : km/heures + réservoir de fin     → dû le dernier jour du mois
  // *RequestedAt = date d'émission de la demande ; *ConfirmedAt = date où le relevé a été validé
  // (km/heures ET réservoir renseignés).
  @Column({ type: 'varchar', nullable: true })
  openingRequestedAt: string | null;

  @Column({ type: 'varchar', nullable: true })
  closingRequestedAt: string | null;

  @Column({ type: 'varchar', nullable: true })
  openingConfirmedAt: string | null;

  @Column({ type: 'varchar', nullable: true })
  closingConfirmedAt: string | null;

  @Column({ type: 'varchar', nullable: true })
  driverCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  requestedAt: string | null;

  @Column({ type: 'varchar', nullable: true })
  respondedAt: string | null;

  @Column({ type: 'varchar', nullable: true })
  photoId: string | null;

  @Column({ type: 'varchar', nullable: true })
  declaredBy: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'timestamptz', nullable: true, default: () => 'now()' })
  createdAt: Date | null;
}
