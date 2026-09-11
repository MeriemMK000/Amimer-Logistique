import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('external_vehicles')
export class ExternalVehicle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  label: string | null;

  @Column({ type: 'varchar', nullable: true })
  plate: string | null;

  @Column({ type: 'varchar', nullable: true })
  owner: string | null;

  @Column({ type: 'varchar', nullable: true })
  contact: string | null;

  @Column({ type: 'varchar', nullable: true })
  siteCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  fuelType: string | null;

  // Retour DG : « le pointage véhicule externe permet de contrôler les factures des fournisseurs ».
  // Fournisseur + tarif convenu → montant attendu = pointé × tarif, comparé à la facture reçue.
  @Column({ type: 'varchar', nullable: true })
  supplier: string | null;

  @Column({ type: 'double precision', nullable: true })
  unitRate: number | null;

  //  'day' (journée) | 'hour' (heure)
  @Column({ type: 'varchar', nullable: true, default: 'day' })
  rateUnit: string | null;

  //  'ENGIN' | 'LEGER' | 'LOURD' — nature (adapte le pointage : heures vs km)
  @Column({ type: 'varchar', nullable: true, default: 'ENGIN' })
  kind: string | null;

  @Column({ type: 'boolean', nullable: true })
  active: boolean | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'timestamptz', nullable: true, default: () => 'now()' })
  createdAt: Date | null;
}
