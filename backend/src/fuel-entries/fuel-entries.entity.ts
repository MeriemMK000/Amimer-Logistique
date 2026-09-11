import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('fuel_entries')
export class FuelEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  date: string | null;

  @Column({ type: 'varchar', nullable: true })
  vehicleCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  driverCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  fuelType: string | null;

  // Sous-type essence : 'SP' (sans plomb) | 'SUPER' | null (gasoil / GPL).
  @Column({ type: 'varchar', nullable: true })
  grade: string | null;

  @Column({ type: 'double precision', nullable: true })
  qty: number | null;

  @Column({ type: 'double precision', nullable: true })
  unitPrice: number | null;

  @Column({ type: 'int', nullable: true })
  kmEnd: number | null;

  @Column({ type: 'int', nullable: true })
  kmStart: number | null;

  @Column({ type: 'int', nullable: true })
  tankBalance: number | null;

  @Column({ type: 'double precision', nullable: true })
  norm: number | null;

  @Column({ type: 'boolean', nullable: true })
  closed: boolean | null;

  @Column({ type: 'int', nullable: true })
  kmCorr: number | null;

  // N° de carte carburant utilisee (import fichier station / Naftal).
  @Column({ type: 'varchar', nullable: true })
  cardNumber: string | null;

  // Montant total du plein (DA) — sert quand on importe un fichier sans quantite/prix.
  @Column({ type: 'double precision', nullable: true })
  amount: number | null;

  // Origine : 'manuel' | 'import' | 'carte' | 'stock_site' | 'pompe_externe' | 'regie'
  @Column({ type: 'varchar', nullable: true })
  source: string | null;

  // Site rattaché (quand le carburant vient du stock d'un site).
  @Column({ type: 'varchar', nullable: true })
  siteCode: string | null;

  // Réf. du bon d'achat régie (quand source = regie).
  @Column({ type: 'varchar', nullable: true })
  regieRef: string | null;
}
