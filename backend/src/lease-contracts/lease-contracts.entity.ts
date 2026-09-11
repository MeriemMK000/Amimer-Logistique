import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('lease_contracts')
export class LeaseContract {
  @PrimaryColumn({ type: 'varchar' })
  id: string;

  @Column({ type: 'varchar', nullable: true })
  vehicleCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  num: string | null;

  @Column({ type: 'int', nullable: true })
  dailyPrice: number | null;

  // Prix d'immobilisation : vehicule immobilise sur place, pas en deplacement.
  // Par defaut ~50% du prix quotidien, mais librement modifiable.
  @Column({ type: 'int', nullable: true })
  immobilizationPrice: number | null;

  @Column({ type: 'varchar', nullable: true })
  startDate: string | null;

  @Column({ type: 'varchar', nullable: true })
  endDate: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
