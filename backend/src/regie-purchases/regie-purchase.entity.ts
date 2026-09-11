import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Bon d'achat carburant en régie (retour DG) — pré-autorisation émise par le bureau
 * AVANT tout achat direct (bidon / pompe hors carte hors cuve).
 * Un QR (`/verify/regie/<verifyToken>`) permet à la station / au chauffeur de confirmer
 * que le bon est authentique et dans les plafonds. Une fois l'achat fait, on enregistre
 * le réel → crée un plein `source = regie` rattaché au bon.
 */
@Entity('regie_purchases')
export class RegiePurchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  ref: string | null;

  @Column({ type: 'varchar', nullable: true })
  verifyToken: string | null;

  @Column({ type: 'varchar', nullable: true })
  vehicleCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  driverCode: string | null;

  @Column({ type: 'varchar', nullable: true, default: 'GASOIL' })
  fuelType: string | null;

  // Sous-type essence (véhicules essence uniquement) : 'SP' (sans plomb) | 'SUPER' | null.
  @Column({ type: 'varchar', nullable: true })
  grade: string | null;

  @Column({ type: 'varchar', nullable: true })
  date: string | null; // émission

  @Column({ type: 'varchar', nullable: true })
  validUntil: string | null;

  @Column({ type: 'double precision', nullable: true })
  maxLiters: number | null;

  @Column({ type: 'double precision', nullable: true })
  maxAmount: number | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  // 'emis' | 'consomme' | 'annule' | 'expire'
  @Column({ type: 'varchar', nullable: true, default: 'emis' })
  status: string | null;

  @Column({ type: 'double precision', nullable: true })
  actualLiters: number | null;

  @Column({ type: 'double precision', nullable: true })
  actualAmount: number | null;

  @Column({ type: 'varchar', nullable: true })
  actualDate: string | null;

  @Column({ type: 'varchar', nullable: true })
  station: string | null;

  @Column({ type: 'varchar', nullable: true })
  linkedFuelEntryId: string | null;

  @Column({ type: 'varchar', nullable: true })
  issuedBy: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'timestamptz', nullable: true, default: () => 'now()' })
  createdAt: Date | null;
}
