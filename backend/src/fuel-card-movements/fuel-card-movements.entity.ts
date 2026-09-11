import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('fuel_card_movements')
export class FuelCardMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  cardId: string | null;

  @Column({ type: 'varchar', nullable: true })
  cardNumber: string | null;

  @Column({ type: 'varchar', nullable: true })
  date: string | null;

  @Column({ type: 'varchar', nullable: true })
  vehicleCode: string | null;

  @Column({ type: 'double precision', nullable: true })
  liters: number | null;

  @Column({ type: 'double precision', nullable: true })
  amount: number | null;

  @Column({ type: 'varchar', nullable: true })
  station: string | null;

  @Column({ type: 'int', nullable: true })
  km: number | null;

  // Type de carburant du passage (déduit du véhicule si absent) — pour le bilan par type.
  @Column({ type: 'varchar', nullable: true })
  fuelType: string | null;

  @Column({ type: 'varchar', nullable: true })
  grade: string | null;

  // Plein correspondant créé dans le registre unique (fuel_entries, source = 'carte').
  @Column({ type: 'varchar', nullable: true })
  linkedFuelEntryId: string | null;

  @Column({ type: 'varchar', nullable: true })
  source: string | null;

  @Column({ type: 'timestamptz', nullable: true, default: () => 'now()' })
  createdAt: Date | null;
}
