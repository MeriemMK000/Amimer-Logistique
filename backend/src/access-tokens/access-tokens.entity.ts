import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('access_tokens')
export class AccessToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  token: string;

  @Column({ type: 'varchar' })
  kind: string; // driver | pec

  @Column({ type: 'varchar', nullable: true })
  subjectCode: string | null; // driverCode pour kind=driver

  @Column({ type: 'varchar', nullable: true })
  label: string | null;

  @Column({ type: 'varchar', nullable: true })
  expiresAt: string | null;

  @Column({ type: 'varchar', nullable: true })
  usedAt: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'timestamptz', nullable: true, default: () => 'now()' })
  createdAt: Date | null;
}
