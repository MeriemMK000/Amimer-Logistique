import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Cle/valeur JSON pour les singletons de configuration de v8 :
 * FUEL_PRICES, PARAMS, BAREME_MISSION, MARGE_TYPE, MARGE_PCT.
 */
@Entity('app_config')
export class AppConfigEntry {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  key: string;

  @Column({ type: 'jsonb' })
  value: unknown;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
