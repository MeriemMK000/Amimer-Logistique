import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Facture d'un fournisseur pour un véhicule / engin externe sur un site + mois (retour DG :
 * « le pointage véhicule externe permet de contrôler les factures que nous font les
 * fournisseurs »). On compare le montant facturé au montant attendu (pointé × tarif).
 */
@Entity('external_invoices')
export class ExternalInvoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  externalCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  siteCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  month: string | null; // YYYY-MM

  // Quantité facturée par le fournisseur + unité ('day' | 'hour').
  @Column({ type: 'double precision', nullable: true })
  invoicedQty: number | null;

  @Column({ type: 'varchar', nullable: true, default: 'day' })
  invoicedUnit: string | null;

  @Column({ type: 'double precision', nullable: true })
  invoicedAmount: number | null;

  @Column({ type: 'varchar', nullable: true })
  invoiceRef: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'timestamptz', nullable: true, default: () => 'now()' })
  createdAt: Date | null;
}
