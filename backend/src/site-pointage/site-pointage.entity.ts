import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('site_pointage')
export class SitePointage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  siteCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  date: string | null;

  @Column({ type: 'varchar', nullable: true })
  targetType: string | null;

  @Column({ type: 'varchar', nullable: true })
  targetCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  unit: string | null;

  @Column({ type: 'double precision', nullable: true })
  quantity: number | null;

  // Grille de pointage (meme modele que le pointage location) : fraction de journee (8 h).
  //   0 = pas travaille · 0.0625 = 30 min · 0.5 = demi-journee · 1 = journee entiere.
  @Column({ type: 'double precision', nullable: true, default: 0 })
  fraction: number | null;

  // Jour d'immobilisation (I) : engin immobilise sur site -> facture au prix d'immobilisation.
  @Column({ type: 'boolean', nullable: true, default: false })
  immobilized: boolean | null;

  // Axes analytiques portes par le pointage (facturation BU / site).
  @Column({ type: 'varchar', nullable: true })
  businessUnit: string | null;

  @Column({ type: 'varchar', nullable: true })
  ca: string | null;

  @Column({ type: 'double precision', nullable: true })
  fuelLiters: number | null;

  @Column({ type: 'int', nullable: true })
  kmStart: number | null;

  @Column({ type: 'int', nullable: true })
  kmEnd: number | null;

  @Column({ type: 'double precision', nullable: true })
  hoursStart: number | null;

  @Column({ type: 'double precision', nullable: true })
  hoursEnd: number | null;

  @Column({ type: 'double precision', nullable: true })
  dayPrice: number | null;

  @Column({ type: 'varchar', nullable: true })
  source: string | null;

  // Plein carburant lié : quand `fuelLiters > 0`, on crée un fuel_entry (source 'dotation_site')
  // pour que la dotation carburant journalière du site entre dans le contrôle carburant.
  @Column({ type: 'varchar', nullable: true })
  linkedFuelEntryId: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'timestamptz', nullable: true, default: () => 'now()' })
  createdAt: Date | null;
}
