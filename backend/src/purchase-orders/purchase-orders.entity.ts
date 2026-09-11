import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('purchase_orders')
export class PurchaseOrder {
  @PrimaryColumn({ type: 'varchar' })
  num: string;

  @Column({ type: 'varchar', nullable: true })
  otNum: string | null;

  @Column({ type: 'varchar', nullable: true })
  supplierCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  date: string | null;

  @Column({ type: 'int', nullable: true })
  amount: number | null;

  @Column({ type: 'varchar', nullable: true })
  status: string | null;

  @Column({ type: 'jsonb', nullable: true })
  items: any | null;
}
