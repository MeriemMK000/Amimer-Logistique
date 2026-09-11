import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Référentiel de lieux (retour DG : « on doit utiliser des adresses si on veut être précis
 * en km »). Contient les wilayas / communes (seed) + tout point ajouté à la main sur la carte
 * ou géocodé. Chaque lieu porte ses coordonnées → distance calculée au point exact.
 */
@Entity('places')
@Index(['name'])
export class Place {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  wilaya: string | null;

  @Column({ type: 'double precision' })
  lat: number;

  @Column({ type: 'double precision' })
  lon: number;

  // 'wilaya' | 'commune' | 'address' | 'poi' | 'pin' (placé sur la carte)
  @Column({ type: 'varchar', nullable: true, default: 'commune' })
  kind: string | null;

  // 'seed' | 'manual' | 'nominatim'
  @Column({ type: 'varchar', nullable: true, default: 'seed' })
  source: string | null;

  @Column({ type: 'int', nullable: true, default: 0 })
  usageCount: number | null;

  @Column({ type: 'timestamptz', nullable: true, default: () => 'now()' })
  createdAt: Date | null;
}
