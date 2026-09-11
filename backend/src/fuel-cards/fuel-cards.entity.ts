import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('fuel_cards')
export class FuelCard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  cardNumber: string | null;

  @Column({ type: 'varchar', nullable: true })
  manager: string | null;

  @Column({ type: 'varchar', nullable: true })
  vehicleCode: string | null;

  @Column({ type: 'double precision', nullable: true })
  monthlyCap: number | null;

  @Column({ type: 'boolean', nullable: true })
  active: boolean | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'timestamptz', nullable: true, default: () => 'now()' })
  createdAt: Date | null;
}
