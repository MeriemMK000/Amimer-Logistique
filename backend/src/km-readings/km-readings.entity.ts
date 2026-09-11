import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Releve kilometrique (prelevement compteur) — Partie 1 module Flotte. */
@Entity('km_readings')
export class KmReading {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  vehicleCode: string;

  @Column({ type: 'varchar' })
  date: string; // YYYY-MM-DD

  @Column({ type: 'int' })
  km: number; // valeur compteur absolue au moment du releve

  @Column({ type: 'varchar', default: 'manual' })
  source: string; // manual | site_start | site_end | import

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
