import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('erp_exports')
export class ErpExport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  type: string;

  @Column({ nullable: true })
  reference: string;

  @Column({ name: 'data_json', type: 'jsonb', nullable: true })
  dataJson: Record<string, unknown>;

  @Column({ default: 'PENDING' })
  status: string;

  @Column({ name: 'exported_at', type: 'timestamp', nullable: true })
  exportedAt: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
