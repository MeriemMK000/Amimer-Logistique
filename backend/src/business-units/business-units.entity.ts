import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('business_units')
export class BusinessUnit {
  @PrimaryColumn({ type: 'varchar' })
  code: string;

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @Column({ type: 'jsonb', nullable: true })
  ca: any | null;

  // Responsable de la structure (retour DG : organigramme réel Amimer).
  @Column({ type: 'jsonb', nullable: true })
  manager: { name?: string; email?: string } | null;
}
