import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('engine_fuel_entries')
export class EngineFuelEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  date: string | null;

  @Column({ type: 'varchar', nullable: true })
  vehicleCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  operator: string | null;

  @Column({ type: 'varchar', nullable: true })
  fuelType: string | null;

  @Column({ type: 'double precision', nullable: true })
  qty: number | null;

  @Column({ type: 'double precision', nullable: true })
  unitPrice: number | null;

  @Column({ type: 'double precision', nullable: true })
  hourEnd: number | null;

  @Column({ type: 'double precision', nullable: true })
  hourStart: number | null;

  @Column({ type: 'double precision', nullable: true })
  normH: number | null;

  @Column({ type: 'boolean', nullable: true })
  closed: boolean | null;
}
