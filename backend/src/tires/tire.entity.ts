import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Pneumatique (Partie 3 : sous-module pneumatique). */
@Entity('tires')
export class Tire {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  reference: string;

  @Column({ type: 'varchar', nullable: true })
  brand: string | null;

  @Column({ type: 'varchar', nullable: true })
  dimensions: string | null; // ex : 315/80 R22.5

  @Column({ type: 'varchar', nullable: true })
  serialNumber: string | null; // numero unique du pneu

  @Column({ type: 'varchar', nullable: true })
  purchaseDate: string | null;

  @Column({ type: 'int', nullable: true })
  purchaseCost: number | null;

  // stock | monte | depose | rebut
  @Column({ type: 'varchar', default: 'stock' })
  status: string;

  @Column({ type: 'varchar', nullable: true })
  currentVehicle: string | null;

  @Column({ type: 'varchar', nullable: true })
  position: string | null; // AVG, AVD, ARG, ARD, ARGE, ARDE, secours...

  @Column({ type: 'int', nullable: true })
  mountKm: number | null;

  @Column({ type: 'varchar', nullable: true })
  mountDate: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
