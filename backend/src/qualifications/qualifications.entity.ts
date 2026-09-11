import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('qualifications')
export class Qualification {
  @PrimaryColumn({ type: 'varchar' })
  code: string;

  @Column({ type: 'varchar', nullable: true })
  label: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', nullable: true })
  sensitive: boolean | null;
}
