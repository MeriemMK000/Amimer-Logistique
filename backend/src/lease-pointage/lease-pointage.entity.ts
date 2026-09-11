import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('lease_pointage')
export class LeasePointage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  vehicleCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  date: string | null;

  // Fraction de journee travaillee (journee = 8 h) :
  //   0 = n'a pas travaille · 0.125 = 1 h · 0.5 = demi-journee · 1 = journee entiere.
  @Column({ type: 'double precision', nullable: true, default: 0 })
  fraction: number | null;

  // Jour d'immobilisation (I) : vehicule immobilise sur place -> facture au prix d'immobilisation.
  @Column({ type: 'boolean', nullable: true, default: false })
  immobilized: boolean | null;

  // Conserve pour compatibilite : derive de fraction (present = fraction > 0).
  @Column({ type: 'boolean', nullable: true })
  present: boolean | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
